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
import { useTriggerScan } from '../../../src/rfid/useTriggerScan';
import { alpha, brand, sage } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/theme';
import { type } from '../../../src/theme/typography';

// Mock "handheld" registration flow — this screen plays the device role that
// server/src/controllers/scanSessions.controller.js says doesn't exist yet (comment: "ยังไม่มี
// แอป handheld จริง"). Trigger -> (mock) scan -> report -> admin confirms on the dashboard's
// "สแกนด้วย Handheld" tab (dashboard/src/sections/fabric/view/handheld-scan-card.jsx), same
// scan_sessions API both sides share. EPC มาจากการเหนี่ยวไกเครื่องอ่านเป็นหลัก — กรอกเอง/วางหลาย
// รายการได้ผ่านปุ่มคีย์บอร์ดมุมขวา (popup) แบบเดียวกับหน้าจ่ายผ้าไปวอร์ด

// ชิป EPC แบบ memo — รายการยาวหลักร้อยชิ้น ถ้าไม่ memo ทุกแท็กที่เข้ามาใหม่จะ render ชิปเดิมทั้งหมดซ้ำ
// (300 ชิ้น = render ชิปรวมหลายหมื่นครั้งระหว่างสแกน) เครื่อง handheld เลยหน่วงหนักขึ้นเรื่อย ๆ
const EpcChip = memo(function EpcChip({ code, label, removable, onRemove, chipStyle, labelStyle, iconColor }) {
  return (
    <View style={chipStyle}>
      <Text style={[type.caption, labelStyle]}>{label ?? code}</Text>
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

function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

const SESSION_STATUS_LABEL = {
  PENDING: 'รอเริ่มสแกน',
  SCANNING: 'กำลังสแกน',
  REPORTED: 'ส่งผลแล้ว — รอ admin ตรวจสอบ',
};

export default function RegisterFabricScreen() {
  const router = useRouter();
  const [lots, setLots] = useState([]);
  const [categories, setCategories] = useState([]);
  const [devices, setDevices] = useState([]);
  const [bindMode, setBindMode] = useState('lot'); // 'lot' | 'category' — ผูกล็อต หรือผูกประเภท
  const [lotId, setLotId] = useState(null);
  const [groupKey, setGroupKey] = useState(null); // หมวดหมู่ที่เลือก (null = ยังไม่เลือก, 'all' = ทุกหมวด, 'none' = ประเภทที่ยังไม่จัดหมวดหมู่)
  const [categoryId, setCategoryId] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [session, setSession] = useState(null); // { id, status, ... }
  const [bulkEpc, setBulkEpc] = useState('');
  const [manualVisible, setManualVisible] = useState(false);
  const [epcCodes, setEpcCodes] = useState([]);
  // EPC ที่มีในระบบแล้ว: { [epc]: { categoryName, otherHospital } } — เช็คตั้งแต่ขั้นสแกน แยกไว้ด้านล่างเป็นชิปแดง
  const [duplicateInfo, setDuplicateInfo] = useState({});
  const [checkingCount, setCheckingCount] = useState(0);
  const checkQueueRef = useRef([]);
  const checkTimerRef = useRef(null);
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
      .then((data) => setDevices(data.devices || []))
      .catch(() => {});
  }, []);

  // ผ้าผูกกับ "ประเภทผ้า" (fabric_categories) เสมอ — หมวดหมู่ผ้า (เช่น ผ้าเสตอไลส์/ผ้าสามัญ) สร้างจาก
  // group_id/group_name ที่ API ประเภทผ้าแนบมาให้ ใช้เลือกเป็นขั้นแรกเพื่อย่อรายการประเภทให้สั้นลง
  const groupOptions = [{ value: 'all', label: 'ทั้งหมด' }];
  categories.forEach((category) => {
    const key = category.group_id ?? 'none';
    if (!groupOptions.some((g) => g.value === key)) {
      groupOptions.push({ value: key, label: category.group_name || 'ไม่ระบุหมวดหมู่' });
    }
  });
  const categoryOptions = categories
    .filter((category) => groupKey === 'all' || (category.group_id ?? 'none') === groupKey)
    .map((category) => ({ value: category.id, label: category.name }));

  const selectGroup = (key) => {
    setGroupKey(key);
    if (!categories.some((c) => c.id === categoryId && (key === 'all' || (c.group_id ?? 'none') === key))) {
      setCategoryId(null);
    }
  };

  const boundId = bindMode === 'lot' ? lotId : categoryId;

  const handleTrigger = async () => {
    if (!boundId || !deviceId) {
      setError(
        bindMode === 'lot'
          ? 'กรุณาเลือกล็อตและอุปกรณ์ handheld ก่อน'
          : 'กรุณาเลือกประเภทและอุปกรณ์ handheld ก่อน'
      );
      return;
    }
    setError('');
    setTriggering(true);
    try {
      const { session: newSession } = await triggerScanSession(
        bindMode === 'lot'
          ? { fabricLotId: lotId, deviceId }
          : { fabricCategoryId: categoryId, deviceId }
      );
      setSession(newSession);
      setEpcCodes([]);
      setDuplicateInfo({});
    } catch (err) {
      setError(err?.message || 'เริ่ม session ไม่สำเร็จ');
    } finally {
      setTriggering(false);
    }
  };

  // รวมแท็กที่สแกนเข้ามาถี่ๆ เป็นก้อนเดียวต่อ 1 request (เหนี่ยวไกทีเดียวแท็กไหลเข้ามาหลายตัว)
  const flushDuplicateCheck = async () => {
    checkTimerRef.current = null;
    const batch = checkQueueRef.current;
    checkQueueRef.current = [];
    if (batch.length === 0) return;
    try {
      const { duplicates } = await checkDuplicateEpcs(batch);
      if (duplicates?.length) {
        setDuplicateInfo((prev) => {
          const next = { ...prev };
          duplicates.forEach((d) => {
            next[d.epcCode] = { categoryName: d.categoryName, otherHospital: d.otherHospital };
          });
          return next;
        });
      }
    } catch {
      // เช็คไม่สำเร็จ (เช่น เน็ตหลุด) — ปล่อยผ่าน server จะข้าม EPC ซ้ำตอนยืนยันอยู่แล้ว
    } finally {
      setCheckingCount((n) => n - batch.length);
    }
  };

  const queueDuplicateCheck = (codes) => {
    if (codes.length === 0) return;
    checkQueueRef.current.push(...codes);
    setCheckingCount((n) => n + codes.length);
    if (!checkTimerRef.current) checkTimerRef.current = setTimeout(flushDuplicateCheck, 300);
  };

  useEffect(() => () => clearTimeout(checkTimerRef.current), []);

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

  // ล้างแท็กที่สแกนไว้ทั้งหมด (รวมรายการซ้ำและคิวเช็คซ้ำที่ค้างอยู่) แล้วรอสแกนใหม่
  const clearEpcs = () => {
    clearTimeout(checkTimerRef.current);
    checkTimerRef.current = null;
    const queued = checkQueueRef.current.length;
    checkQueueRef.current = [];
    if (queued > 0) setCheckingCount((n) => n - queued);
    clearTimeout(tagFlushTimerRef.current);
    tagFlushTimerRef.current = null;
    pendingTagsRef.current = [];
    scannedRef.current = new Set();
    setEpcCodes([]);
    setDuplicateInfo({});
    setError('');
  };

  const removeEpc = useCallback((code) => {
    setEpcCodes((prev) => prev.filter((c) => c !== code));
  }, []);

  const { newCodes, duplicateCodes } = useMemo(
    () => ({
      newCodes: epcCodes.filter((c) => !duplicateInfo[c]),
      duplicateCodes: epcCodes.filter((c) => duplicateInfo[c]),
    }),
    [epcCodes, duplicateInfo]
  );

  // เหนี่ยวปุ่มไกที่ตัวเครื่อง → เพิ่มแท็กเข้ารายการเตรียมส่ง (เปิดฟังเฉพาะช่วงที่ยังเก็บ EPC อยู่)
  const { hasRfidDevice, rfidStatus, rfidErrorMessage, triggerActive } = useTriggerScan({
    enabled: !!session && session?.status !== 'REPORTED',
    registeredOnly: false, // หน้านี้ลงทะเบียนแท็กใหม่ — ต้องเห็นแท็กที่ยังไม่มีในระบบ
    onEpc: addScannedTag,
  });

  const handleReport = async () => {
    if (newCodes.length === 0) {
      setError(
        duplicateCodes.length > 0
          ? 'EPC ที่สแกนซ้ำกับในระบบทั้งหมด ไม่มีรายการใหม่ให้ส่ง'
          : 'กรุณาเพิ่มรหัส EPC อย่างน้อย 1 รายการ'
      );
      return;
    }
    setError('');
    setReporting(true);
    try {
      // ส่งเฉพาะแท็กใหม่ — แท็กซ้ำไม่ลงทะเบียนอยู่แล้ว
      await reportScanSession(session.id, { epcCodes: newCodes });
      setSession((prev) => ({ ...prev, status: 'REPORTED' }));
    } catch (err) {
      setError(err?.message || 'ส่งผลสแกนไม่สำเร็จ');
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
    setEpcCodes([]);
    setDuplicateInfo({});
    setLotId(null);
    setCategoryId(null);
    setGroupKey(null);
    setDeviceId(null);
  };

  const isReported = session?.status === 'REPORTED';

  return (
    <ScreenContainer>
      {!session ? (
        <>
          <AppCard style={styles.pickerCard}>
            <View style={styles.segment}>
              {[
                { key: 'lot', label: 'ผูกล็อต' },
                { key: 'category', label: 'ผูกประเภท' },
              ].map((item) => {
                const active = bindMode === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setBindMode(item.key)}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}
                  >
                    <Text style={[type.subtitle2, styles.segmentLabel, active && styles.segmentLabelActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {bindMode === 'lot' ? (
              <>
                <Text style={[type.subtitle2, styles.label]}>ล็อตผ้า</Text>
                {lots.length === 0 ? (
                  <Text style={[type.body2, styles.label]}>ยังไม่มีล็อตผ้าในระบบ</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {lots.map((lot) => (
                        <Pressable
                          key={lot.id}
                          onPress={() => setLotId(lot.id)}
                          style={[styles.chip, lotId === lot.id && styles.chipActive]}
                        >
                          <Text
                            style={[type.body2, styles.chipLabel, lotId === lot.id && styles.chipLabelActive]}
                          >
                            {lot.lot_code}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </>
            ) : (
              categories.length === 0 ? (
                <Text style={[type.body2, styles.label]}>ยังไม่มีประเภทผ้าในระบบ</Text>
              ) : (
                <>
                  <SelectField
                    label="1. หมวดหมู่ผ้า"
                    placeholder="เลือกหมวดหมู่ผ้า"
                    value={groupKey}
                    options={groupOptions}
                    onChange={selectGroup}
                  />
                  <SelectField
                    label="2. ประเภทผ้า"
                    placeholder={groupKey ? 'เลือกประเภทผ้า (พิมพ์ค้นหาได้)' : 'เลือกหมวดหมู่ผ้าก่อน'}
                    value={categoryId}
                    options={categoryOptions}
                    onChange={setCategoryId}
                    searchable
                    disabled={!groupKey}
                    emptyText="ไม่มีประเภทผ้าในหมวดหมู่นี้"
                  />
                </>
              )
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
                      style={[styles.chip, deviceId === device.id && styles.chipActive]}
                    >
                      <Text
                        style={[type.body2, styles.chipLabel, deviceId === device.id && styles.chipLabelActive]}
                      >
                        #{device.id} {device.caretaker_name || ''}
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
            disabled={triggering || !boundId || !deviceId}
          >
            เริ่มสแกน
          </AppButton>
        </>
      ) : (
        <>
          <AppCard style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={[type.subtitle1, styles.label]}>สถานะ session</Text>
              <StatusChip
                label={SESSION_STATUS_LABEL[session.status] ?? session.status}
                color={isReported ? 'success' : 'info'}
              />
            </View>
          </AppCard>

          {!isReported && (
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
                รายการที่ {isReported ? 'ส่งไปแล้ว' : 'เตรียมส่ง'} ({newCodes.length})
                {checkingCount > 0 ? ' · กำลังตรวจ EPC ซ้ำ...' : ''}
              </Text>
              {!isReported && epcCodes.length > 0 ? (
                <Pressable onPress={clearEpcs} style={styles.clearButton} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle-outline" size={18} color={brand.primary.dark} />
                  <Text style={[type.subtitle2, styles.clearButtonLabel]}>ล้าง</Text>
                </Pressable>
              ) : null}
            </View>
            {newCodes.length === 0 ? (
              <Text style={[type.body2, styles.label]}>ยังไม่มีรายการ</Text>
            ) : (
              <View style={styles.chipRow}>
                {newCodes.map((code) => (
                  <EpcChip
                    key={code}
                    code={code}
                    removable={!isReported}
                    onRemove={removeEpc}
                    chipStyle={styles.epcChip}
                    labelStyle={styles.epcChipLabel}
                    iconColor={sage.text}
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
                      removable={!isReported}
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

          {isReported ? (
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
                ส่งผลสแกน
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
  error: {
    color: brand.error.main,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: brand.grey[100],
    borderRadius: radius.sm,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm - 2,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentLabel: {
    color: brand.grey[500],
  },
  segmentLabelActive: {
    color: sage.text,
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
