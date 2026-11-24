import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Modal, Portal, TextInput } from 'react-native-paper';

import { lookupFabricByEpcs, statusChangeScan } from '../../src/api/operations.api';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { PermissionGate } from '../../src/components/PermissionGate';
import { ReasonPicker } from '../../src/components/ReasonPicker';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { StatusChip } from '../../src/components/StatusChip';
import { TriggerScanStatus } from '../../src/components/TriggerScanStatus';
import {
  buildReasonCode,
  REWASH_REASON_OPTIONS,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../../src/constants/fabric';
import { useScanReady } from '../../src/context/ScanReadyContext';
import { createEpcBatchQueue } from '../../src/rfid/epcBatchQueue';
import { rememberFabricLookup } from '../../src/rfid/registeredTagFilter';
import { useTriggerScan } from '../../src/rfid/useTriggerScan';
import { alpha, brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

// หน้า "เปลี่ยนสถานะผ้า" — สแกนก่อน แล้วระบบจัดกลุ่มตามสถานะที่เจอจริง ผู้ใช้เลือกกลุ่ม + สถานะปลายทาง
// แล้วกดเปลี่ยนทีเดียว (เดิมต้องเลือกสถานะก่อน/หลังก่อนถึงจะสแกนได้ และต้องกด "ตรวจสอบ" อีกรอบ)
//
// ความเร็ว — ใช้แนวเดียวกับหน้าสแกนค้นหาผ้า ("ลิสต์ก่อน ตรวจทีหลัง"):
//  - แท็กขึ้นรายการทันที (รอตรวจสอบ) พักไว้ใน ref แล้ว setState รวมทุก TAG_FLUSH_MS
//  - ตรวจสถานะเบื้องหลังผ่าน createEpcBatchQueue (POST /tracking/lookup ทีละก้อน ≤ 200 ไม่ยิงซ้อน)
//  - ผลตรวจที่ได้ = สถานะปัจจุบันใช้จัดกลุ่มได้เลย ไม่ต้องยิง preview ซ้ำ — ตอนยืนยันส่ง fromStatuses
//    (กลุ่มที่เลือก) ให้ server เปลี่ยนเฉพาะชิ้นที่ยังอยู่ในกลุ่มนั้นจริง ชิ้นที่ถูกสแกนผ่านจุดอื่นไป
//    ระหว่างนั้นถูกข้าม (staleStatus) แล้วหน้านี้ตรวจสถานะใหม่ให้อัตโนมัติ
//  - server ทำทั้งชุดเป็น query ก้อนเดียวใน transaction (ดู scans.controller.js#statusChange)
//  - ไม่ใช้ cache สถานะจาก registeredTagFilter — จัดกลุ่มจากผลสดเท่านั้น (สถานะเก่าจะพาเปลี่ยนผิดกลุ่ม)
const TAG_FLUSH_MS = 150;
const APPLY_CHUNK = 500; // server รับสูงสุด 500 EPC ต่อ request
const MAX_GROUP_ROWS = 100; // รายชิ้นที่แสดงตอนกางกลุ่ม (นับครบในตัวเลขกลุ่มอยู่แล้ว)

// สถานะปลายทางที่เลือกได้ (ตรงกับ STATUS_CHANGE_STATUSES ฝั่ง server) — REWASH แยกไว้ปุ่มเด่นท้ายสุด
const TARGET_STATUSES = [
  'WASH',
  'CENTRAL_STOCK',
  'CENTRAL_SUPPLY',
  'WARD_CABINET',
  'IN_USE_WARD',
  'REWASH',
];
// เปลี่ยนจากหน้านี้ไม่ได้ — มี flow อนุมัติแยก (รายการพัก & ชำรุด)
const BLOCKED_STATUSES = new Set(['HOLD', 'DECOMMISSIONED', 'PENDING_DECOMMISSION']);
// ลำดับกลุ่ม = ลำดับ lifecycle แล้วตามด้วยสถานะ exception
const GROUP_ORDER = [
  'WASH',
  'CENTRAL_STOCK',
  'CENTRAL_SUPPLY',
  'WARD_CABINET',
  'IN_USE_WARD',
  'REWASH',
  'HOLD',
  'PENDING_DECOMMISSION',
  'DECOMMISSIONED',
];
const TARGET_ICON = {
  WASH: 'washing-machine',
  CENTRAL_STOCK: 'warehouse',
  CENTRAL_SUPPLY: 'medical-bag',
  WARD_CABINET: 'archive-outline',
  IN_USE_WARD: 'bed-outline',
  REWASH: 'refresh',
};

function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

async function fetchLookupBatch(codes) {
  const { items = [], notFound = [] } = await lookupFabricByEpcs(codes);
  rememberFabricLookup(items, notFound);
  const byEpc = {};
  items.forEach((item) => {
    byEpc[item.epcCode] = item;
  });
  return byEpc;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export default function StatusChangeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { setScanReady } = useScanReady();

  const [epcs, setEpcs] = useState([]); // ลำดับที่สแกน ล่าสุดอยู่บน
  // epc -> { state: 'pending' | 'found' | 'notFound' | 'error', item? }
  const [info, setInfo] = useState({});
  const [pendingCount, setPendingCount] = useState(0);
  const [excluded, setExcluded] = useState(() => new Set()); // กลุ่มสถานะที่ผู้ใช้ติ๊กออก
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [toStatus, setToStatus] = useState(null);
  const [reasonCode, setReasonCode] = useState(null);
  const [reasonOther, setReasonOther] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const [manualVisible, setManualVisible] = useState(false);
  const [bulkEpc, setBulkEpc] = useState('');

  const seenRef = useRef(new Set()); // กันแท็กซ้ำแบบ sync (แท็กไหลเข้าเร็วกว่า state อัปเดต)
  const incomingRef = useRef([]);
  const flushTimerRef = useRef(null);

  const queueRef = useRef(null);
  if (!queueRef.current) {
    queueRef.current = createEpcBatchQueue({
      fetchBatch: fetchLookupBatch,
      onPendingChange: setPendingCount,
      onResults: (byEpc) => {
        setInfo((prev) => {
          const next = { ...prev };
          Object.entries(byEpc).forEach(([code, item]) => {
            if (!seenRef.current.has(code)) return; // ผู้ใช้ลบทิ้งไปแล้วระหว่างรอผล
            next[code] = item ? { state: 'found', item } : { state: 'notFound' };
          });
          return next;
        });
      },
      onFailed: (codes, err) => {
        setInfo((prev) => {
          const next = { ...prev };
          codes.forEach((code) => {
            if (!seenRef.current.has(code)) return;
            next[code] = { state: 'error', message: err?.message };
          });
          return next;
        });
      },
    });
  }

  useEffect(() => {
    setScanReady(isFocused);
    return () => setScanReady(false);
  }, [isFocused, setScanReady]);

  useEffect(
    () => () => {
      clearTimeout(flushTimerRef.current);
      queueRef.current?.dispose();
    },
    []
  );

  const flushIncoming = () => {
    flushTimerRef.current = null;
    const fresh = incomingRef.current;
    incomingRef.current = [];
    if (fresh.length === 0) return;
    setEpcs((prev) => [...fresh.slice().reverse(), ...prev]);
    setInfo((prev) => {
      const next = { ...prev };
      fresh.forEach((code) => {
        next[code] = { state: 'pending' };
      });
      return next;
    });
    queueRef.current.push(fresh);
  };

  const addEpcs = (codes, { immediate = false } = {}) => {
    let added = false;
    codes.forEach((raw) => {
      const code = typeof raw === 'string' ? raw.trim() : '';
      if (!code || seenRef.current.has(code)) return;
      seenRef.current.add(code);
      incomingRef.current.push(code);
      added = true;
    });
    if (!added) return;
    setLastResult(null);
    if (immediate) {
      clearTimeout(flushTimerRef.current);
      flushIncoming();
    } else if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flushIncoming, TAG_FLUSH_MS);
    }
  };

  // เอาแท็กออกจากรายการ (ลบเอง / เปลี่ยนสถานะสำเร็จแล้ว) — สแกนเจออีกครั้งจะเข้ามาใหม่พร้อมสถานะล่าสุด
  const removeEpcs = useCallback((codes) => {
    const drop = new Set(codes);
    if (drop.size === 0) return;
    drop.forEach((code) => {
      seenRef.current.delete(code);
      queueRef.current?.remove(code);
    });
    incomingRef.current = incomingRef.current.filter((c) => !drop.has(c));
    setEpcs((prev) => prev.filter((c) => !drop.has(c)));
    setInfo((prev) => {
      const next = { ...prev };
      drop.forEach((code) => delete next[code]);
      return next;
    });
  }, []);

  const removeEpc = useCallback((code) => removeEpcs([code]), [removeEpcs]);

  const handleClear = () => {
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    incomingRef.current = [];
    queueRef.current.clear();
    seenRef.current = new Set();
    setEpcs([]);
    setInfo({});
    setExcluded(new Set());
    setExpandedGroup(null);
    setError('');
    setLastResult(null);
  };

  const requeue = (codes) => {
    if (codes.length === 0) return;
    setInfo((prev) => {
      const next = { ...prev };
      codes.forEach((c) => {
        next[c] = { state: 'pending' };
      });
      return next;
    });
    queueRef.current.push(codes);
  };

  // ไม่ปิดเครื่องอ่านระหว่างกดเปลี่ยน (enabled สลับ = ตัด/ต่อเครื่องอ่านใหม่ ช้า) — แท็กที่เข้ามาระหว่างนั้น
  // แค่ต่อท้ายรายการแล้วตรวจตามปกติ
  const { hasRfidDevice, rfidStatus, rfidErrorMessage, triggerActive } = useTriggerScan({
    registeredOnly: false,
    onEpc: (code) => addEpcs([code]),
  });

  // จัดกลุ่มตามสถานะปัจจุบัน (เฉพาะแท็กที่ตรวจแล้ว) + นับประเภทผ้าในแต่ละกลุ่ม
  const summary = useMemo(() => {
    const groups = new Map(); // status -> { status, codes: [], categories: Map }
    let waiting = 0;
    let failed = 0;
    const notFound = [];
    epcs.forEach((code) => {
      const entry = info[code];
      if (!entry || entry.state === 'pending') waiting += 1;
      else if (entry.state === 'error') failed += 1;
      else if (entry.state === 'notFound') notFound.push(code);
      else {
        const { status } = entry.item;
        if (!groups.has(status)) groups.set(status, { status, codes: [], categories: new Map() });
        const group = groups.get(status);
        group.codes.push(code);
        const name = entry.item.categoryName || 'ไม่ระบุประเภทผ้า';
        group.categories.set(name, (group.categories.get(name) || 0) + 1);
      }
    });
    const orderOf = (s) => {
      const idx = GROUP_ORDER.indexOf(s);
      return idx === -1 ? GROUP_ORDER.length : idx;
    };
    const list = [...groups.values()]
      .map((g) => ({
        ...g,
        categoryText: [...g.categories.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, n]) => `${name} ${n}`)
          .join(' · '),
      }))
      .sort((a, b) => orderOf(a.status) - orderOf(b.status));
    return { groups: list, waiting, failed, notFound };
  }, [epcs, info]);

  const groupState = (status) => {
    if (BLOCKED_STATUSES.has(status)) return 'blocked';
    if (status === toStatus) return 'same';
    return excluded.has(status) ? 'off' : 'on';
  };

  const selectedGroups = summary.groups.filter((g) => groupState(g.status) === 'on');
  const selectedCodes = selectedGroups.flatMap((g) => g.codes);
  const selectedCount = selectedCodes.length;

  const toggleGroup = (status) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const reasonValid = reasonCode !== 'OTHER' || reasonOther.trim().length > 0;
  const canApply =
    !!toStatus && selectedCount > 0 && summary.waiting === 0 && !applying && reasonValid;

  const handleApply = async () => {
    if (!canApply) return;
    setError('');
    setApplying(true);
    const target = toStatus;
    const reason = target === 'REWASH' && reasonCode ? buildReasonCode(reasonCode, reasonOther) : undefined;
    const fromStatuses = selectedGroups.map((g) => g.status);
    const appliedCodes = [];
    const doneCodes = []; // เป็นสถานะปลายทางอยู่แล้ว / ไม่พบ — เอาออกจากรายการเหมือนกัน
    const staleCodes = [];
    let failure = null;
    try {
      for (const part of chunk(selectedCodes, APPLY_CHUNK)) {
        // eslint-disable-next-line no-await-in-loop
        const result = await statusChangeScan({
          epcCodes: part,
          fromStatuses,
          toStatus: target,
          ...(reason ? { reasonCode: reason } : {}),
          confirm: true,
        });
        (result.applied ?? []).forEach((a) => appliedCodes.push(a.epcCode));
        (result.alreadyDone ?? []).forEach((a) => doneCodes.push(a.epcCode));
        (result.notFound ?? []).forEach((c) => doneCodes.push(c));
        (result.staleStatus ?? []).forEach((s) => staleCodes.push(s.epcCode));
        (result.blocked ?? []).forEach((s) => staleCodes.push(s.epcCode));
      }
    } catch (err) {
      failure = err?.message || 'เปลี่ยนสถานะไม่สำเร็จ';
    }

    // ชิ้นที่เปลี่ยนแล้วออกจากรายการ — ที่เหลือ (กลุ่มที่ไม่ได้เลือก) ยังอยู่ ให้เลือกเปลี่ยนเป็นสถานะอื่นต่อได้
    removeEpcs([...appliedCodes, ...doneCodes]);
    // สถานะเปลี่ยนไประหว่างนั้น — ตรวจใหม่ให้เห็นสถานะจริง แล้วค่อยตัดสินใจอีกรอบ
    requeue(staleCodes);

    if (appliedCodes.length > 0) {
      setRecent((prev) =>
        [
          {
            at: Date.now(),
            toStatus: target,
            fromStatuses,
            count: appliedCodes.length,
            reasonCode: reason ?? null,
          },
          ...prev,
        ].slice(0, 10)
      );
    }
    setLastResult({ toStatus: target, applied: appliedCodes.length, stale: staleCodes.length });
    if (failure) {
      setError(
        appliedCodes.length > 0
          ? `เปลี่ยนแล้ว ${appliedCodes.length} ชิ้น แต่บางส่วนไม่สำเร็จ: ${failure} — กดเปลี่ยนอีกครั้งได้`
          : failure
      );
    }
    setApplying(false);
  };

  const retryFailed = () => requeue(epcs.filter((c) => info[c]?.state === 'error'));

  let applyLabel = 'เลือกสถานะปลายทาง';
  if (summary.waiting > 0) applyLabel = `กำลังตรวจสอบแท็ก… (เหลือ ${summary.waiting})`;
  else if (toStatus && selectedCount === 0) applyLabel = 'ไม่มีกลุ่มที่เลือก';
  else if (toStatus) applyLabel = `เปลี่ยน ${selectedCount} ชิ้น → ${STATUS_LABEL[toStatus]}`;

  return (
    <PermissionGate perm="handheld.status_change.view">
      <ScreenContainer>
        <Pressable onPress={() => router.back()} style={styles.backLink} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={brand.grey[700]} />
          <Text style={[type.body2, styles.muted700]}>กลับ</Text>
        </Pressable>

        <Text style={[type.h3, styles.title]}>เปลี่ยนสถานะผ้า</Text>

        {/* ขั้นที่ 1 — สแกน */}
        <AppCard style={styles.card} elevated>
          <View style={styles.titleRow}>
            <View style={styles.stepBadge}>
              <Text style={[type.subtitle2, styles.stepBadgeText]}>1</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[type.subtitle1, styles.dark]}>สแกนผ้า</Text>
              <Text style={[type.body2, styles.muted]}>
                เหนี่ยวไกค้างแล้วกวาดผ่านกองผ้า — ระบบจัดกลุ่มตามสถานะที่เจอให้เอง
              </Text>
            </View>
            <Pressable onPress={() => setManualVisible(true)} style={styles.cornerButton} hitSlop={8}>
              <MaterialCommunityIcons name="keyboard-outline" size={18} color={brand.primary.dark} />
            </Pressable>
          </View>

          {hasRfidDevice ? (
            <TriggerScanStatus
              status={rfidStatus}
              errorMessage={rfidErrorMessage}
              triggerActive={triggerActive}
              busy={applying || (pendingCount > 0 && !triggerActive)}
              busyLabel={
                applying ? 'กำลังเปลี่ยนสถานะ...' : `กำลังตรวจสอบแท็กกับระบบ... เหลือ ${pendingCount} ชิ้น`
              }
              idleLabel="เหนี่ยวปุ่มไกค้างไว้เพื่อสแกนหลายชิ้น"
            />
          ) : (
            <Text style={[type.body2, styles.muted]}>
              ยังไม่ได้เลือกเครื่องอ่าน RFID — กดปุ่มคีย์บอร์ดมุมขวาเพื่อกรอกรหัส EPC เอง
            </Text>
          )}

          {lastResult ? (
            <View style={styles.resultBox}>
              <MaterialCommunityIcons name="check-circle" size={20} color={brand.success.dark} />
              <Text style={[type.body2, styles.resultText]}>
                เปลี่ยนเป็น “{STATUS_LABEL[lastResult.toStatus]}” แล้ว {lastResult.applied} ชิ้น
                {lastResult.stale > 0
                  ? ` · ข้าม ${lastResult.stale} ชิ้น (สถานะเปลี่ยนไประหว่างนั้น ตรวจใหม่ให้แล้ว)`
                  : ''}
              </Text>
            </View>
          ) : null}
        </AppCard>

        {/* ขั้นที่ 2 — กลุ่มสถานะที่เจอ */}
        {epcs.length > 0 ? (
          <AppCard style={styles.card} elevated>
            <View style={styles.titleRow}>
              <View style={styles.stepBadge}>
                <Text style={[type.subtitle2, styles.stepBadgeText]}>2</Text>
              </View>
              <Text style={[type.subtitle1, styles.dark, styles.flex]}>
                เจอ {epcs.length} ชิ้น · {summary.groups.length} สถานะ
              </Text>
              <Pressable onPress={handleClear} style={styles.clearButton} hitSlop={8} disabled={applying}>
                <MaterialCommunityIcons name="close-circle-outline" size={18} color={brand.primary.dark} />
                <Text style={[type.subtitle2, styles.clearLabel]}>ล้าง</Text>
              </Pressable>
            </View>

            {summary.waiting > 0 || summary.failed > 0 || summary.notFound.length > 0 ? (
              <View style={styles.chipRow}>
                {summary.waiting > 0 ? (
                  <StatusChip label={`รอตรวจสอบ ${summary.waiting}`} color="info" />
                ) : null}
                {summary.notFound.length > 0 ? (
                  <Pressable onPress={() => removeEpcs(summary.notFound)}>
                    <StatusChip label={`ไม่พบในระบบ ${summary.notFound.length} ✕`} color="default" />
                  </Pressable>
                ) : null}
                {summary.failed > 0 ? (
                  <Pressable onPress={retryFailed}>
                    <StatusChip label={`ตรวจไม่สำเร็จ ${summary.failed} — แตะลองใหม่`} color="warning" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {summary.groups.length === 0 ? (
              <Text style={[type.body2, styles.muted]}>กำลังตรวจสถานะ...</Text>
            ) : (
              <View style={styles.groupList}>
                {summary.groups.map((group) => (
                  <StatusGroupRow
                    key={group.status}
                    group={group}
                    state={groupState(group.status)}
                    expanded={expandedGroup === group.status}
                    onToggle={toggleGroup}
                    onExpand={setExpandedGroup}
                    onRemove={removeEpc}
                    disabled={applying}
                  />
                ))}
              </View>
            )}
          </AppCard>
        ) : null}

        {/* ขั้นที่ 3 — สถานะปลายทาง */}
        {epcs.length > 0 ? (
          <AppCard style={styles.card} elevated>
            <View style={styles.titleRow}>
              <View style={styles.stepBadge}>
                <Text style={[type.subtitle2, styles.stepBadgeText]}>3</Text>
              </View>
              <Text style={[type.subtitle1, styles.dark, styles.flex]}>เปลี่ยนเป็นสถานะ</Text>
            </View>

            <View style={styles.targetGrid}>
              {TARGET_STATUSES.map((s) => {
                const active = toStatus === s;
                const rewash = s === 'REWASH';
                return (
                  <Pressable
                    key={s}
                    onPress={() => setToStatus(active ? null : s)}
                    disabled={applying}
                    style={[
                      styles.targetChip,
                      rewash && styles.targetChipWide,
                      active && (rewash ? styles.targetChipRewashActive : styles.targetChipActive),
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={TARGET_ICON[s]}
                      size={18}
                      color={active ? '#FFFFFF' : rewash ? brand.error.dark : brand.primary.dark}
                    />
                    <Text
                      style={[
                        type.subtitle2,
                        styles.targetText,
                        rewash && styles.targetTextRewash,
                        active && styles.targetTextActive,
                      ]}
                      numberOfLines={2}
                    >
                      {STATUS_LABEL[s]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {toStatus === 'REWASH' ? (
              <View style={styles.reasonBox}>
                <Text style={[type.caption, styles.muted]}>
                  เหตุผลที่ส่งซักใหม่ (ไม่บังคับ — ช่วยให้วิเคราะห์ได้ว่าปัญหามาจากอะไร)
                </Text>
                <ReasonPicker
                  options={REWASH_REASON_OPTIONS}
                  allowDeselect
                  value={reasonCode}
                  onChange={setReasonCode}
                  otherText={reasonOther}
                  onChangeOtherText={setReasonOther}
                  disabled={applying}
                />
              </View>
            ) : null}

            <AppButton
              variant="filled"
              icon={toStatus ? 'swap-horizontal' : undefined}
              onPress={handleApply}
              loading={applying}
              disabled={!canApply}
              contentStyle={styles.applyButton}
            >
              {applyLabel}
            </AppButton>
          </AppCard>
        ) : null}

        {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

        {recent.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={[type.subtitle2, styles.muted600]}>รายการล่าสุด</Text>
            {recent.map((r) => (
              <AppCard key={r.at} style={styles.historyCard}>
                <Text style={[type.body2, styles.dark]}>
                  {r.fromStatuses.map((s) => STATUS_LABEL[s] ?? s).join(', ')} → {STATUS_LABEL[r.toStatus]}
                </Text>
                <Text style={[type.caption, styles.muted600]}>
                  เปลี่ยน {r.count} ชิ้น ·{' '}
                  {new Date(r.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </AppCard>
            ))}
          </View>
        ) : null}

        <Portal>
          <Modal
            visible={manualVisible}
            onDismiss={() => setManualVisible(false)}
            contentContainerStyle={styles.modalWrap}
          >
            <View style={styles.modalCard}>
              <Text style={[type.subtitle1, styles.dark]}>กรอกรหัส EPC (วางได้หลายรายการ)</Text>
              <TextInput
                mode="outlined"
                value={bulkEpc}
                onChangeText={setBulkEpc}
                placeholder={'เช่น\nEPC-0001\nEPC-0002'}
                multiline
                numberOfLines={5}
                autoFocus
                autoCapitalize="characters"
                autoCorrect={false}
                outlineColor={brand.grey[300]}
                activeOutlineColor={brand.primary.main}
                style={styles.modalInput}
              />
              <View style={styles.modalActions}>
                <AppButton variant="text" onPress={() => setManualVisible(false)} style={styles.flex}>
                  ยกเลิก
                </AppButton>
                <AppButton
                  variant="filled"
                  onPress={() => {
                    addEpcs(parseEpcCodes(bulkEpc), { immediate: true });
                    setBulkEpc('');
                    setManualVisible(false);
                  }}
                  disabled={!bulkEpc.trim()}
                  style={styles.flex}
                >
                  เพิ่ม
                </AppButton>
              </View>
            </View>
          </Modal>
        </Portal>
      </ScreenContainer>
    </PermissionGate>
  );
}

// memo — ผลตรวจกลับมาทีละก้อน กลุ่มที่จำนวนไม่เปลี่ยนก็ยังได้ object ใหม่จาก useMemo อยู่ดี แต่ถ้าไม่ได้
// กางรายชิ้นไว้ แถวนี้เบามาก (render แค่หัวกลุ่ม) — รายชิ้น render เฉพาะกลุ่มที่กางอยู่ ≤ MAX_GROUP_ROWS
const StatusGroupRow = memo(function StatusGroupRow({
  group,
  state,
  expanded,
  onToggle,
  onExpand,
  onRemove,
  disabled,
}) {
  const selectable = state === 'on' || state === 'off';
  const checked = state === 'on';
  let note = null;
  if (state === 'blocked') note = 'เปลี่ยนจากหน้านี้ไม่ได้ (มี flow อนุมัติแยก) — ไม่นับรวม';
  else if (state === 'same') note = 'เป็นสถานะปลายทางอยู่แล้ว — ข้าม';
  else if (state === 'off') note = 'ไม่เปลี่ยนกลุ่มนี้';

  return (
    <View style={[styles.groupCard, checked && styles.groupCardOn]}>
      <View style={styles.groupHeader}>
        <Pressable
          onPress={() => onToggle(group.status)}
          disabled={!selectable || disabled}
          hitSlop={8}
          style={styles.checkbox}
        >
          <MaterialCommunityIcons
            name={
              !selectable
                ? 'minus-box-outline'
                : checked
                  ? 'checkbox-marked'
                  : 'checkbox-blank-outline'
            }
            size={26}
            color={!selectable ? brand.grey[400] : checked ? brand.primary.main : brand.grey[500]}
          />
        </Pressable>
        <Pressable
          style={styles.groupMain}
          onPress={() => onExpand(expanded ? null : group.status)}
          hitSlop={4}
        >
          <View style={styles.groupTitleRow}>
            <StatusChip
              label={STATUS_LABEL[group.status] ?? group.status}
              color={STATUS_COLOR[group.status] || 'default'}
            />
            <View style={styles.flex} />
            <Text style={[type.h3, selectable ? styles.dark : styles.muted]}>{group.codes.length}</Text>
            <Text style={[type.caption, styles.muted]}> ชิ้น</Text>
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={brand.grey[500]}
            />
          </View>
          <Text style={[type.caption, styles.muted600]} numberOfLines={expanded ? undefined : 1}>
            {group.categoryText}
          </Text>
          {note ? <Text style={[type.caption, styles.groupNote]}>{note}</Text> : null}
        </Pressable>
      </View>

      {expanded ? (
        <View style={styles.epcList}>
          {group.codes.slice(0, MAX_GROUP_ROWS).map((code) => (
            <View key={code} style={styles.epcRow}>
              <Text style={[type.caption, styles.epcText]} numberOfLines={1} ellipsizeMode="middle">
                {code}
              </Text>
              <Pressable onPress={() => onRemove(code)} hitSlop={10} disabled={disabled}>
                <MaterialCommunityIcons name="close" size={16} color={brand.grey[500]} />
              </Pressable>
            </View>
          ))}
          {group.codes.length > MAX_GROUP_ROWS ? (
            <Text style={[type.caption, styles.muted]}>
              …และอีก {group.codes.length - MAX_GROUP_ROWS} ชิ้น
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dark: { color: brand.grey[800] },
  muted: { color: brand.grey[500] },
  muted600: { color: brand.grey[600] },
  muted700: { color: brand.grey[700] },
  error: { color: brand.error.main },
  backLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  title: { color: brand.grey[800], marginTop: 4 },
  card: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
  },
  stepBadgeText: { color: brand.primary.dark },
  cornerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: brand.grey[100],
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
  clearLabel: { color: brand.primary.dark },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: alpha(brand.success.main, 0.12),
  },
  resultText: { flex: 1, color: brand.success.dark },
  groupList: { gap: 8 },
  groupCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 6,
    gap: 8,
  },
  groupCardOn: { borderColor: brand.primary.main, backgroundColor: alpha(brand.primary.main, 0.05) },
  groupHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  checkbox: { padding: 4 },
  groupMain: { flex: 1, gap: 4 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  groupNote: { color: brand.warning.dark },
  epcList: { gap: 6, paddingLeft: 38 },
  epcRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  epcText: { flex: 1, color: brand.grey[700] },
  targetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  targetChip: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: '#FFFFFF',
  },
  targetChipWide: {
    flexBasis: '100%',
    borderColor: alpha(brand.error.main, 0.5),
    backgroundColor: alpha(brand.error.main, 0.06),
  },
  targetChipActive: { backgroundColor: brand.primary.main, borderColor: brand.primary.main },
  targetChipRewashActive: { backgroundColor: brand.error.main, borderColor: brand.error.main },
  targetText: { flex: 1, color: brand.grey[800] },
  targetTextRewash: { color: brand.error.dark },
  targetTextActive: { color: '#FFFFFF' },
  reasonBox: { gap: 8 },
  applyButton: { minHeight: 52 },
  historySection: { gap: 8 },
  historyCard: { padding: 12, gap: 2 },
  modalWrap: { paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: radius.card, padding: 20, gap: 16 },
  modalInput: { backgroundColor: '#FFFFFF', minHeight: 110, borderRadius: radius.sm },
  modalActions: { flexDirection: 'row', gap: 10 },
});
