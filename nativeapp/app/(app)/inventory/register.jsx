import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Modal, Portal, TextInput } from 'react-native-paper';

import { fetchDevices } from '../../../src/api/devices.api';
import { checkDuplicateEpcs } from '../../../src/api/fabric.api';
import { fetchFabricCategories } from '../../../src/api/fabricCategories.api';
import { fetchFabricLots } from '../../../src/api/fabricLots.api';
import {
  cancelScanSession,
  reportScanSession,
  triggerScanSession,
} from '../../../src/api/scanSessions.api';
import { AppButton } from '../../../src/components/AppButton';
import { AppCard } from '../../../src/components/AppCard';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { SelectField } from '../../../src/components/SelectField';
import { StatusChip } from '../../../src/components/StatusChip';
import { TriggerScanStatus } from '../../../src/components/TriggerScanStatus';
import { createEpcBatchQueue } from '../../../src/rfid/epcBatchQueue';
import { useTriggerScan } from '../../../src/rfid/useTriggerScan';
import { alpha, brand, sage } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/theme';
import { type } from '../../../src/theme/typography';

// ลงทะเบียนผ้าใหม่จาก handheld: เลือกประเภทผ้า + ล็อต (ไม่บังคับ) -> เริ่มรอบ (trigger) -> สแกน -> ส่งผล (report) -> server
// ลงทะเบียนเข้าฐานข้อมูลทันที ไม่ต้องรอแอดมินอนุมัติบนเว็บ (ดู server/src/controllers/scanSessions.controller.js)
// EPC มาจากการเหนี่ยวไกเครื่องอ่านเป็นหลัก — กรอกเอง/วางหลาย
// รายการได้ผ่านปุ่มคีย์บอร์ดมุมขวา (popup) แบบเดียวกับหน้าจ่ายผ้าไปวอร์ด

// ชิป EPC แบบ memo — รายการยาวหลักร้อยชิ้น ถ้าไม่ memo ทุกแท็กที่เข้ามาใหม่จะ render ชิปเดิมทั้งหมดซ้ำ
// (300 ชิ้น = render ชิปรวมหลายหมื่นครั้งระหว่างสแกน) เครื่อง handheld เลยหน่วงหนักขึ้นเรื่อย ๆ
// pending = ยังรอตรวจกับ server ว่าซ้ำในระบบไหม (ชิปจาง + ไอคอนนาฬิกา) ตรวจแล้วจึงเป็นสีปกติ
const EpcChip = memo(function EpcChip({
  code,
  label,
  removable,
  onRemove,
  chipStyle,
  labelStyle,
  iconColor,
  pending = false,
}) {
  return (
    <View style={[chipStyle, pending && styles.epcChipPending]}>
      {pending ? <MaterialCommunityIcons name="clock-outline" size={12} color={brand.grey[500]} /> : null}
      <Text style={[type.caption, pending ? styles.epcChipPendingLabel : labelStyle]}>{label ?? code}</Text>
      {removable && (
        <Pressable onPress={() => onRemove(code)} hitSlop={6}>
          <MaterialCommunityIcons name="close" size={14} color={iconColor} />
        </Pressable>
      )}
    </View>
  );
});

// รวมแท็กที่ไหลเข้ามาจากเครื่องอ่าน แล้ว setState ทีเดียวต่อรอบนี้ (แทนที่จะ setState ทุกแท็ก)
const TAG_FLUSH_MS = 150;

// "ลิสต์ก่อน ตรวจทีหลัง": แท็กขึ้นรายการทันที (ชิปรอตรวจ) แล้วทยอยเช็ค EPC ซ้ำกับระบบเบื้องหลังผ่าน
// createEpcBatchQueue — ทีละก้อน ≤ 200 ไม่ยิงซ้อน ลองใหม่เองถ้าเน็ตสะดุด (เดิมยิงทุก 300ms ไม่จำกัดขนาด
// ก้อน/ไม่รอก้อนก่อน: สแกนรัวจนเกิน 500 ในรอบเดียว server ตอบ 400 แล้วแท็กชุดนั้นไม่ถูกเช็คซ้ำเลยแบบเงียบ ๆ)
async function fetchDuplicateBatch(codes) {
  const { duplicates = [] } = await checkDuplicateEpcs(codes);
  const byEpc = {};
  duplicates.forEach((d) => {
    byEpc[d.epcCode] = { categoryName: d.categoryName, otherHospital: d.otherHospital };
  });
  return byEpc;
}

function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

const SESSION_STATUS_LABEL = {
  PENDING: 'รอเริ่มสแกน',
  SCANNING: 'กำลังสแกน',
  CONFIRMED: 'เพิ่มผ้าเข้าระบบแล้ว',
  // server เวอร์ชันเดิม (ยังไม่ลงทะเบียนอัตโนมัติ) ตอบสถานะนี้
  REPORTED: 'ส่งผลแล้ว — รอ admin ตรวจสอบ',
};

const DONE_STATUSES = ['CONFIRMED', 'REPORTED'];

// ชื่ออุปกรณ์ = ประเภทอุปกรณ์ (ต้องตรงกับ DEVICE_TYPE_LABEL ฝั่งเว็บ) — หน้านี้มีแต่ handheld จึงแยกเครื่องด้วยบรรทัดรอง
const HANDHELD_NAME = 'เครื่องสแกนมือถือ (Handheld)';
// ประเภทผ้าในล็อต (server เวอร์ชันเก่ายังไม่ส่ง lines -> ใช้ประเภทเดียวของล็อต)
const lotCategoryIdsOf = (lot) => {
  if (!lot) return [];
  if (lot.lines) return lot.lines.map((line) => line.category_id);
  return lot.fabric_category_id ? [lot.fabric_category_id] : [];
};

const deviceDetail = (device) =>
  device.caretaker_name ? `ผู้ดูแล ${device.caretaker_name}` : `รหัสอุปกรณ์ ${device.id}`;

export default function RegisterFabricScreen() {
  const router = useRouter();
  const [lots, setLots] = useState([]);
  const [categories, setCategories] = useState([]);
  const [devices, setDevices] = useState([]);
  const [lotId, setLotId] = useState(null); // null = ไม่ผูกล็อต (เช่น ผ้าเก่าที่ใช้งานมานาน)
  // หมวดหมู่ที่เลือก (null = ยังไม่เลือก, 'all' = ทุกหมวด, 'none' = ประเภทที่ยังไม่จัดหมวดหมู่, 'lot' = ประเภทในล็อตที่เลือก)
  const [groupKey, setGroupKey] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [session, setSession] = useState(null); // { id, status, ... }
  const [result, setResult] = useState(null); // ผลลงทะเบียนของรอบ { created, skipped } (จำนวนชิ้น)
  const [bulkEpc, setBulkEpc] = useState('');
  const [manualVisible, setManualVisible] = useState(false);
  const [epcCodes, setEpcCodes] = useState([]);
  // EPC ที่มีในระบบแล้ว: { [epc]: { categoryName, otherHospital } } — เช็คตั้งแต่ขั้นสแกน แยกไว้ด้านล่างเป็นชิปแดง
  const [duplicateInfo, setDuplicateInfo] = useState({});
  // ผลตรวจรายแท็ก: { [epc]: 'ok' | 'error' } — ไม่มี key = ยังรอตรวจ, ซ้ำ = อยู่ใน duplicateInfo
  const [checkState, setCheckState] = useState({});
  const [checkingCount, setCheckingCount] = useState(0); // แท็กที่ยังรอตรวจ (ในคิว + กำลังถาม)
  const checkQueueRef = useRef(null);
  if (!checkQueueRef.current) {
    checkQueueRef.current = createEpcBatchQueue({
      fetchBatch: fetchDuplicateBatch,
      onPendingChange: setCheckingCount,
      onResults: (byEpc) => {
        const dups = {};
        const status = {};
        Object.entries(byEpc).forEach(([code, dup]) => {
          if (dup) dups[code] = dup;
          else status[code] = 'ok';
        });
        if (Object.keys(dups).length) setDuplicateInfo((prev) => ({ ...prev, ...dups }));
        setCheckState((prev) => ({ ...prev, ...status }));
      },
      onFailed: (codes) => {
        setCheckState((prev) => {
          const next = { ...prev };
          codes.forEach((c) => {
            next[c] = 'error';
          });
          return next;
        });
      },
    });
  }
  const [triggering, setTriggering] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFabricLots()
      .then((data) => setLots(data.lots || []))
      .catch(() => {});
    fetchFabricCategories()
      .then((data) => setCategories(data.categories || []))
      .catch(() => {});
    fetchDevices({ deviceType: 'HANDHELD' })
      .then((data) => {
        const list = data.devices || [];
        setDevices(list);
        if (list.length === 1) setDeviceId(list[0].id); // มีเครื่องเดียว ไม่ต้องให้เลือก
      })
      .catch(() => {});
  }, []);

  // ผ้าผูกกับ "ประเภทผ้า" (fabric_categories) เสมอ ส่วนล็อตไม่บังคับ และ 1 ล็อตมีได้หลายประเภท
  // หมวดหมู่ผ้า (เช่น ผ้าเสตอไลส์/ผ้าสามัญ) สร้างจาก group_id/group_name ที่ API ประเภทผ้าแนบมาให้
  // ใช้เลือกเป็นขั้นแรกเพื่อย่อรายการประเภทให้สั้นลง — เลือกล็อตไว้จะมีตัวเลือก "ในล็อต ..." เพิ่มมาให้
  const lot = lots.find((item) => item.id === lotId) ?? null;
  const lotCategoryIds = lotCategoryIdsOf(lot);

  const lotOptions = [
    { value: null, label: 'ไม่ผูกล็อต' },
    ...lots.map((item) => ({ value: item.id, label: item.lot_code })),
  ];

  const groupOptions = [
    ...(lotCategoryIds.length > 0 ? [{ value: 'lot', label: `ในล็อต ${lot.lot_code}` }] : []),
    { value: 'all', label: 'ทั้งหมด' },
  ];
  categories.forEach((category) => {
    const key = category.group_id ?? 'none';
    if (!groupOptions.some((g) => g.value === key)) {
      groupOptions.push({ value: key, label: category.group_name || 'ไม่ระบุหมวดหมู่' });
    }
  });

  const isInGroup = (category, key) => {
    if (key === 'all') return true;
    if (key === 'lot') return lotCategoryIds.includes(category.id);
    return (category.group_id ?? 'none') === key;
  };
  const categoryOptions = categories
    .filter((category) => isInGroup(category, groupKey))
    .map((category) => ({ value: category.id, label: category.name }));

  const selectGroup = (key) => {
    setGroupKey(key);
    if (!categories.some((c) => c.id === categoryId && isInGroup(c, key))) setCategoryId(null);
  };

  // เลือกล็อต -> ขึ้นเฉพาะประเภทในล็อตนั้น ถ้ามีประเภทเดียวเลือกให้เอง (เปลี่ยนเป็นประเภทอื่นได้จากช่องหมวดหมู่)
  const selectLot = (id) => {
    setLotId(id);
    const ids = lotCategoryIdsOf(lots.find((item) => item.id === id));
    if (ids.length === 0) {
      if (groupKey === 'lot') setGroupKey('all');
      return;
    }
    setGroupKey('lot');
    if (ids.length === 1) setCategoryId(ids[0]);
    else if (!ids.includes(categoryId)) setCategoryId(null);
  };

  const notInLot = !!lot && !!categoryId && !lotCategoryIds.includes(categoryId);

  const handleTrigger = async () => {
    if (!categoryId || !deviceId) {
      setError('กรุณาเลือกประเภทผ้าและอุปกรณ์ handheld ก่อน');
      return;
    }
    setError('');
    setTriggering(true);
    try {
      const { session: newSession } = await triggerScanSession({
        fabricLotId: lotId ?? undefined,
        fabricCategoryId: categoryId,
        deviceId,
      });
      // server เวอร์ชันเก่าใช้ประเภทของล็อตแทนประเภทที่เลือก — ส่งผลแล้วเข้าระบบทันที ปล่อยผ่านจะลงผิดประเภท
      if (newSession.fabricCategoryId !== categoryId) {
        cancelScanSession(newSession.id).catch(() => {});
        setError('ต้องอัปเดต server ก่อนจึงเลือกประเภทผ้าคู่กับล็อตได้ — ระหว่างนี้เลือก "ไม่ผูกล็อต"');
        return;
      }
      setSession(newSession);
      setResult(null);
      resetScannedTags();
    } catch (err) {
      setError(err?.message || 'เริ่ม session ไม่สำเร็จ');
    } finally {
      setTriggering(false);
    }
  };

  const queueDuplicateCheck = (codes) => {
    if (codes.length === 0) return;
    checkQueueRef.current.push(codes);
  };

  useEffect(() => () => checkQueueRef.current?.dispose(), []);

  // epcCodes เก็บทุกแท็กที่สแกนติด (ซ้ำหรือไม่ซ้ำ) — หน้าจอ/การส่งผลแยกกลุ่มทีหลังจาก duplicateInfo
  const scannedRef = useRef(new Set());
  // แท็กที่รับมาแล้วแต่ยังไม่ได้ flush เข้า state (ดู TAG_FLUSH_MS)
  const pendingTagsRef = useRef([]);
  const tagFlushTimerRef = useRef(null);
  useEffect(() => {
    scannedRef.current = new Set([...epcCodes, ...pendingTagsRef.current]);
  }, [epcCodes]);

  const addEpcs = (codes) => {
    const fresh = [...new Set(codes)].filter((c) => !scannedRef.current.has(c));
    if (fresh.length === 0) return;
    fresh.forEach((c) => scannedRef.current.add(c));
    setEpcCodes((prev) => [...prev, ...fresh]);
    queueDuplicateCheck(fresh);
  };

  const flushPendingTags = () => {
    tagFlushTimerRef.current = null;
    const batch = pendingTagsRef.current;
    pendingTagsRef.current = [];
    if (batch.length === 0) return;
    setEpcCodes((prev) => [...prev, ...batch]);
    queueDuplicateCheck(batch);
  };

  // เครื่องอ่านยิงแท็กเข้ามาทีละตัวถี่มาก — เก็บพักไว้แล้ว flush เป็นก้อน
  const addScannedTag = (code) => {
    if (!code || scannedRef.current.has(code)) return;
    scannedRef.current.add(code);
    pendingTagsRef.current.push(code);
    if (!tagFlushTimerRef.current) tagFlushTimerRef.current = setTimeout(flushPendingTags, TAG_FLUSH_MS);
  };

  useEffect(() => () => clearTimeout(tagFlushTimerRef.current), []);

  const addBulkEpcs = () => {
    const codes = parseEpcCodes(bulkEpc);
    if (codes.length === 0) return;
    addEpcs(codes);
    setBulkEpc('');
  };

  // ล้างแท็กที่สแกนไว้ทั้งหมด (รวมรายการซ้ำและคิวเช็คซ้ำที่ค้างอยู่ — ผลที่ยังค้างจะถูกทิ้ง)
  function resetScannedTags() {
    checkQueueRef.current.clear();
    clearTimeout(tagFlushTimerRef.current);
    tagFlushTimerRef.current = null;
    pendingTagsRef.current = [];
    scannedRef.current = new Set();
    setEpcCodes([]);
    setDuplicateInfo({});
    setCheckState({});
  }

  const clearEpcs = () => {
    resetScannedTags();
    setError('');
  };

  const removeEpc = useCallback((code) => {
    checkQueueRef.current?.remove(code);
    setEpcCodes((prev) => prev.filter((c) => c !== code));
  }, []);

  const retryFailedChecks = () => {
    const failed = epcCodes.filter((c) => checkState[c] === 'error' && !duplicateInfo[c]);
    if (failed.length === 0) return;
    setCheckState((prev) => {
      const next = { ...prev };
      failed.forEach((c) => delete next[c]);
      return next;
    });
    queueDuplicateCheck(failed);
  };

  const { newCodes, duplicateCodes, failedCount, verifiedCount } = useMemo(() => {
    const fresh = epcCodes.filter((c) => !duplicateInfo[c]);
    return {
      newCodes: fresh,
      duplicateCodes: epcCodes.filter((c) => duplicateInfo[c]),
      failedCount: fresh.filter((c) => checkState[c] === 'error').length,
      verifiedCount: fresh.filter((c) => checkState[c] === 'ok').length,
    };
  }, [epcCodes, duplicateInfo, checkState]);

  const isDone = DONE_STATUSES.includes(session?.status);

  // เหนี่ยวปุ่มไกที่ตัวเครื่อง → เพิ่มแท็กเข้ารายการเตรียมส่ง (เปิดฟังเฉพาะช่วงที่ยังเก็บ EPC อยู่)
  const { hasRfidDevice, rfidStatus, rfidErrorMessage, triggerActive } = useTriggerScan({
    enabled: !!session && !isDone,
    registeredOnly: false, // หน้านี้ลงทะเบียนแท็กใหม่ — ต้องเห็นแท็กที่ยังไม่มีในระบบ
    onEpc: addScannedTag,
  });

  const handleReport = async () => {
    if (newCodes.length === 0) {
      setError(
        duplicateCodes.length > 0
          ? 'EPC ที่สแกนซ้ำกับในระบบทั้งหมด ไม่มีผ้าใหม่ให้เพิ่ม'
          : 'กรุณาเพิ่มรหัส EPC อย่างน้อย 1 รายการ'
      );
      return;
    }
    setError('');
    setReporting(true);
    try {
      // ส่งเฉพาะแท็กใหม่ — แท็กซ้ำไม่ลงทะเบียนอยู่แล้ว (เน็ตหลุดก่อนได้คำตอบ กดส่งใหม่ได้ server ตอบผลเดิม)
      const data = await reportScanSession(session.id, { epcCodes: newCodes });
      if (data.status === 'CONFIRMED') {
        setResult({ created: data.created.length, skipped: data.skipped.length });
      }
      setSession((prev) => ({ ...prev, status: data.status }));
    } catch (err) {
      setError(err?.message || 'เพิ่มผ้าเข้าระบบไม่สำเร็จ');
    } finally {
      setReporting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelScanSession(session.id);
    } catch {
      // เพิกเฉย — ยกเลิก local state ต่อไปได้แม้ call ล้มเหลว (เช่น session ปิดไปแล้วฝั่ง server)
    }
    setSession(null);
    resetScannedTags();
    setLotId(null);
    setCategoryId(null);
    setGroupKey(null);
  };

  return (
    <ScreenContainer>
      {!session ? (
        <>
          <AppCard style={styles.pickerCard}>
            {categories.length === 0 ? (
              <Text style={[type.body2, styles.label]}>ยังไม่มีประเภทผ้าในระบบ</Text>
            ) : (
              <>
                <SelectField
                  label="1. ล็อต (ไม่บังคับ)"
                  value={lotId}
                  options={lotOptions}
                  onChange={selectLot}
                  searchable
                />
                <SelectField
                  label="2. หมวดหมู่ผ้า"
                  placeholder="เลือกหมวดหมู่ผ้า"
                  value={groupKey}
                  options={groupOptions}
                  onChange={selectGroup}
                />
                <SelectField
                  label="3. ประเภทผ้า"
                  placeholder={groupKey ? 'เลือกประเภทผ้า (พิมพ์ค้นหาได้)' : 'เลือกหมวดหมู่ผ้าก่อน'}
                  value={categoryId}
                  options={categoryOptions}
                  onChange={setCategoryId}
                  searchable
                  disabled={!groupKey}
                  emptyText="ไม่มีประเภทผ้าในหมวดหมู่นี้"
                />
                {notInLot ? (
                  <Text style={[type.body2, styles.warning]}>
                    ประเภทนี้ไม่อยู่ในล็อต {lot.lot_code} — ลงทะเบียนได้ ระบบจะเพิ่มประเภทนี้เข้าล็อตให้อัตโนมัติ
                  </Text>
                ) : null}
              </>
            )}
          </AppCard>

          <AppCard style={styles.pickerCard}>
            <Text style={[type.subtitle2, styles.label]}>อุปกรณ์ Handheld</Text>
            {devices.length === 0 ? (
              <Text style={[type.body2, styles.label]}>
                ยังไม่มีอุปกรณ์ handheld ที่ผูกกับโรงพยาบาลนี้
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {devices.map((device) => (
                    <Pressable
                      key={device.id}
                      onPress={() => setDeviceId(device.id)}
                      style={[
                        styles.chip,
                        styles.deviceChip,
                        deviceId === device.id && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[type.body2, styles.chipLabel, deviceId === device.id && styles.chipLabelActive]}
                      >
                        {HANDHELD_NAME}
                      </Text>
                      <Text
                        style={[
                          type.caption,
                          styles.chipDetail,
                          deviceId === device.id && styles.chipLabelActive,
                        ]}
                      >
                        {deviceDetail(device)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          </AppCard>

          {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

          <AppButton
            variant="filled"
            onPress={handleTrigger}
            loading={triggering}
            disabled={triggering || !categoryId || !deviceId}
          >
            เริ่มสแกน
          </AppButton>
        </>
      ) : (
        <>
          <AppCard style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={[type.subtitle1, styles.label]}>สถานะ</Text>
              <StatusChip
                label={SESSION_STATUS_LABEL[session.status] ?? session.status}
                color={isDone ? 'success' : 'info'}
              />
            </View>
            <Text style={[type.body2, styles.label, styles.resultText]}>
              {[session.categoryName, session.lotCode ? `ล็อต ${session.lotCode}` : 'ไม่ผูกล็อต']
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {result ? (
              <Text style={[type.body2, styles.label, styles.resultText]}>
                เพิ่มผ้าใหม่ {result.created} ชิ้น
                {result.skipped > 0 ? ` (ข้าม ${result.skipped} ชิ้นที่มีในระบบแล้ว)` : ''}
              </Text>
            ) : null}
          </AppCard>

          {!isDone && (
            <AppCard style={styles.pickerCard}>
              <View style={styles.stepHeaderRow}>
                <Text style={[type.subtitle2, styles.label]}>สแกนผ้าเข้ารายการ</Text>
                <Pressable
                  onPress={() => setManualVisible(true)}
                  style={styles.cornerEntryButton}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="keyboard-outline" size={18} color={brand.primary.dark} />
                </Pressable>
              </View>

              {hasRfidDevice ? (
                <TriggerScanStatus
                  status={rfidStatus}
                  errorMessage={rfidErrorMessage}
                  triggerActive={triggerActive}
                  idleLabel="เหนี่ยวปุ่มไกที่ตัวเครื่องเพื่อสแกนผ้าเข้ารายการ"
                />
              ) : (
                <Text style={[type.body2, styles.label]}>
                  ยังไม่ได้เลือกเครื่องอ่าน RFID — กดปุ่มคีย์บอร์ดมุมขวาเพื่อกรอกรหัส EPC เอง
                </Text>
              )}
            </AppCard>
          )}

          <AppCard style={styles.listCard}>
            <View style={styles.stepHeaderRow}>
              <Text style={[type.subtitle2, styles.label, styles.listTitle]}>
                {isDone ? 'รายการที่ส่งแล้ว' : 'รายการที่จะเพิ่ม'} ({newCodes.length})
              </Text>
              {!isDone && epcCodes.length > 0 ? (
                <Pressable onPress={clearEpcs} style={styles.clearButton} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle-outline" size={18} color={brand.primary.dark} />
                  <Text style={[type.subtitle2, styles.clearButtonLabel]}>ล้าง</Text>
                </Pressable>
              ) : null}
            </View>
            {!isDone && epcCodes.length > 0 ? (
              <View style={styles.checkRow}>
                <StatusChip label={`ตรวจแล้ว ${verifiedCount + duplicateCodes.length}/${epcCodes.length}`} color="success" />
                {checkingCount > 0 ? (
                  <StatusChip label={`กำลังตรวจ EPC ซ้ำ ${checkingCount}`} color="info" />
                ) : null}
                {failedCount > 0 ? (
                  <Pressable onPress={retryFailedChecks} hitSlop={6}>
                    <StatusChip label={`ตรวจไม่สำเร็จ ${failedCount} — แตะเพื่อลองใหม่`} color="warning" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {newCodes.length === 0 ? (
              <Text style={[type.body2, styles.label]}>ยังไม่มีรายการ</Text>
            ) : (
              <View style={styles.chipRow}>
                {newCodes.map((code) => (
                  <EpcChip
                    key={code}
                    code={code}
                    removable={!isDone}
                    onRemove={removeEpc}
                    chipStyle={styles.epcChip}
                    labelStyle={styles.epcChipLabel}
                    iconColor={sage.text}
                    pending={!isDone && !checkState[code]}
                  />
                ))}
              </View>
            )}
          </AppCard>

          {duplicateCodes.length > 0 ? (
            <AppCard style={[styles.listCard, styles.duplicateCard]}>
              <Text style={[type.subtitle2, styles.duplicateTitle]}>
                EPC ซ้ำในระบบ ({duplicateCodes.length}) — จะไม่ถูกลงทะเบียน
              </Text>
              <View style={styles.chipRow}>
                {duplicateCodes.map((code) => {
                  const info = duplicateInfo[code];
                  return (
                    <EpcChip
                      key={code}
                      code={code}
                      label={`${code} — ${
                        info.otherHospital ? 'ลงทะเบียนที่โรงพยาบาลอื่นแล้ว' : info.categoryName || 'ไม่ระบุประเภท'
                      }`}
                      removable={!isDone}
                      onRemove={removeEpc}
                      chipStyle={styles.duplicateChip}
                      labelStyle={styles.duplicateChipLabel}
                      iconColor={brand.error.dark}
                    />
                  );
                })}
              </View>
            </AppCard>
          ) : null}

          {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

          {isDone ? (
            <AppButton variant="filled" onPress={() => router.back()}>
              เสร็จสิ้น — กลับหน้าคลังผ้า
            </AppButton>
          ) : (
            <View style={styles.actionRow}>
              <AppButton
                variant="filled"
                onPress={handleReport}
                loading={reporting}
                disabled={reporting || checkingCount > 0}
                style={styles.actionButton}
              >
                เพิ่มผ้าเข้าระบบ
              </AppButton>
              <AppButton variant="text" onPress={handleCancel} disabled={reporting} style={styles.actionButton}>
                ยกเลิก
              </AppButton>
            </View>
          )}
        </>
      )}

      <Portal>
        <Modal
          visible={manualVisible}
          onDismiss={() => setManualVisible(false)}
          contentContainerStyle={styles.modalWrap}
        >
          <View style={styles.modalCard}>
            <Text style={[type.subtitle1, styles.modalTitle]}>กรอก / วางรหัส EPC</Text>
            <TextInput
              mode="outlined"
              value={bulkEpc}
              onChangeText={setBulkEpc}
              placeholder={'วางได้หลายรายการ เช่น\nEPC-0001\nEPC-0002'}
              multiline
              numberOfLines={5}
              autoFocus
              autoCapitalize="characters"
              outlineColor={brand.grey[300]}
              activeOutlineColor={brand.primary.main}
              style={styles.modalBulkInput}
            />
            <View style={styles.modalActions}>
              <AppButton
                variant="text"
                onPress={() => setManualVisible(false)}
                style={styles.modalActionButton}
              >
                ยกเลิก
              </AppButton>
              <AppButton
                variant="filled"
                onPress={() => {
                  addBulkEpcs();
                  setManualVisible(false);
                }}
                disabled={!bulkEpc.trim()}
                style={styles.modalActionButton}
              >
                เพิ่ม
              </AppButton>
            </View>
          </View>
        </Modal>
      </Portal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pickerCard: {
    gap: 10,
  },
  statusCard: {
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: brand.grey[600],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.grey[300],
  },
  chipActive: {
    backgroundColor: sage.tint,
    borderColor: brand.primary.main,
  },
  chipLabel: {
    color: brand.grey[700],
  },
  chipLabelActive: {
    color: sage.text,
  },
  // ปุ่มเลือกเครื่องมี 2 บรรทัด (ชื่อ + ผู้ดูแล) ทรงแคปซูลแบบชิปบรรทัดเดียวจะดูเป็นวงรี
  deviceChip: {
    borderRadius: radius.md,
  },
  chipDetail: {
    color: brand.grey[500],
  },
  resultText: {
    marginTop: 8,
  },
  error: {
    color: brand.error.main,
  },
  warning: {
    color: brand.warning.dark,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cornerEntryButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: brand.grey[100],
  },
  modalWrap: {
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    color: brand.grey[800],
  },
  modalBulkInput: {
    backgroundColor: '#FFFFFF',
    minHeight: 110,
    borderRadius: radius.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalActionButton: {
    flex: 1,
  },
  listTitle: {
    flex: 1,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: sage.tint,
  },
  clearButtonLabel: {
    color: brand.primary.dark,
  },
  listCard: {
    gap: 10,
  },
  epcChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: alpha(brand.primary.main, 0.12),
  },
  epcChipLabel: {
    color: sage.text,
  },
  epcChipPending: {
    backgroundColor: brand.grey[100],
    borderWidth: 1,
    borderColor: brand.grey[300],
    borderStyle: 'dashed',
  },
  epcChipPendingLabel: {
    color: brand.grey[500],
  },
  checkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  duplicateCard: {
    backgroundColor: alpha(brand.error.main, 0.06),
    borderColor: alpha(brand.error.main, 0.3),
    borderWidth: 1,
  },
  duplicateTitle: {
    color: brand.error.dark,
  },
  duplicateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: alpha(brand.error.main, 0.14),
  },
  duplicateChipLabel: {
    color: brand.error.dark,
    flexShrink: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
});
