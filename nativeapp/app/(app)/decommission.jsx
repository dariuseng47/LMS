import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Modal, Portal, TextInput } from 'react-native-paper';

import { decommissionFabricItem } from '../../src/api/fabric.api';
import { lookupFabricByEpcs } from '../../src/api/operations.api';
import { useAuth } from '../../src/auth/AuthContext';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { PermissionGate } from '../../src/components/PermissionGate';
import { ReasonPicker, validateReason } from '../../src/components/ReasonPicker';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { StatusChip } from '../../src/components/StatusChip';
import { TriggerScanStatus } from '../../src/components/TriggerScanStatus';
import { buildReasonCode, formatReasonCode, STATUS_LABEL } from '../../src/constants/fabric';
import { useScanReady } from '../../src/context/ScanReadyContext';
import { useTriggerScan } from '../../src/rfid/useTriggerScan';
import { alpha, brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

// เมนู "จำหน่ายผ้าชำรุด" — สแกนผ้าชำรุดเป็นชุด เลือกเหตุผล (ชุดเดียวกับเว็บ; "อื่นๆ" กรอกเอง) แนบรูปได้
// แล้วส่งคำขอแทงชำรุดทีละชิ้นผ่าน POST /fabric-items/:id/decommission เดียวกับหน้าเว็บ
// คำขอจากมือถือไม่มีผลทันที — ผ้าเข้าสถานะ "รออนุมัติแทงชำรุด" จน admin โรงพยาบาลกดอนุมัติ/ปฏิเสธที่เว็บ
// › จัดการผ้าและล็อต › รายการพัก & ชำรุด (/dashboard/fabric/hold) ดู fabricItems.controller.js
//
// ข้อมูลผ้า (ประเภท/สถานะ) ค้นรวดเดียวผ่าน POST /tracking/lookup เป็นก้อนเหมือนหน้าสแกนค้นหาผ้า
const LOOKUP_BATCH = 200;
const FLUSH_DELAY_MS = 250;
// ส่งคำขอซ้ำไม่ได้ (server ตอบ 400 INVALID_STATE) — ข้ามไว้ตั้งแต่หน้าจอ
const BLOCKED_STATUSES = new Set(['PENDING_DECOMMISSION', 'DECOMMISSIONED']);

function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

function shortEpc(epc) {
  return epc.length > 8 ? epc.slice(-8) : epc;
}

export default function DecommissionScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { can } = useAuth();
  const { setScanReady } = useScanReady();
  const canEdit = can('handheld.hold.edit');

  const [epcCodes, setEpcCodes] = useState([]); // ลำดับที่สแกน ล่าสุดอยู่บน
  const [info, setInfo] = useState({}); // epc -> { state: 'loading' | 'found' | 'notFound' | 'error', item? }
  const [manualVisible, setManualVisible] = useState(false);
  const [bulkEpc, setBulkEpc] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [otherText, setOtherText] = useState('');
  const [photo, setPhoto] = useState(null); // expo-image-picker asset | null
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [failures, setFailures] = useState({}); // epc -> ข้อความ error ของรอบส่งล่าสุด
  const [recent, setRecent] = useState([]); // [{ at, count, reason }]

  const seenRef = useRef(new Set());
  const queueRef = useRef([]);
  const flushTimerRef = useRef(null);
  const inFlightRef = useRef(false);
  const generationRef = useRef(0);

  useEffect(() => {
    setScanReady(isFocused);
    return () => setScanReady(false);
  }, [isFocused, setScanReady]);

  useEffect(() => () => clearTimeout(flushTimerRef.current), []);

  const flush = async () => {
    flushTimerRef.current = null;
    if (inFlightRef.current || queueRef.current.length === 0) return;
    const generation = generationRef.current;
    const batch = queueRef.current.splice(0, LOOKUP_BATCH);
    inFlightRef.current = true;

    const next = {};
    try {
      const { items = [] } = await lookupFabricByEpcs(batch);
      items.forEach((item) => {
        next[item.epcCode] = { state: 'found', item };
      });
      batch.forEach((code) => {
        if (!next[code]) next[code] = { state: 'notFound' };
      });
    } catch (err) {
      batch.forEach((code) => {
        next[code] = { state: 'error', message: err?.message };
      });
    }

    if (generation === generationRef.current) setInfo((prev) => ({ ...prev, ...next }));
    inFlightRef.current = false;
    if (queueRef.current.length > 0) scheduleFlush(0);
  };

  const scheduleFlush = (delay = FLUSH_DELAY_MS) => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(flush, delay);
  };

  // knownItems: epc -> ข้อมูลผ้าที่ useTriggerScan เพิ่งค้นมาตอนกรองแท็ก — ใช้เลยไม่ต้องค้นซ้ำ
  const addEpcs = (codes, knownItems) => {
    const fresh = codes.map((c) => c.trim()).filter((c) => c && !seenRef.current.has(c));
    if (fresh.length === 0) return;
    fresh.forEach((c) => seenRef.current.add(c));
    setError('');
    setEpcCodes((prev) => [...[...fresh].reverse(), ...prev]);
    setInfo((prev) => {
      const next = { ...prev };
      fresh.forEach((c) => {
        const item = knownItems?.[c];
        next[c] = item ? { state: 'found', item } : { state: 'loading' };
      });
      return next;
    });
    const toLookup = fresh.filter((c) => !knownItems?.[c]);
    if (toLookup.length === 0) return;
    queueRef.current.push(...toLookup);
    scheduleFlush();
  };

  const removeEpc = (code) => {
    seenRef.current.delete(code);
    queueRef.current = queueRef.current.filter((c) => c !== code);
    setEpcCodes((prev) => prev.filter((c) => c !== code));
    setFailures((prev) => {
      if (!prev[code]) return prev;
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const clearAll = () => {
    generationRef.current += 1;
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    queueRef.current = [];
    seenRef.current = new Set();
    setEpcCodes([]);
    setInfo({});
    setFailures({});
    setError('');
  };

  const retryLookup = () => {
    const failed = epcCodes.filter((c) => info[c]?.state === 'error');
    if (failed.length === 0) return;
    setInfo((prev) => {
      const next = { ...prev };
      failed.forEach((c) => {
        next[c] = { state: 'loading' };
      });
      return next;
    });
    queueRef.current.push(...failed);
    scheduleFlush(0);
  };

  const {
    hasRfidDevice,
    rfidStatus,
    rfidErrorMessage,
    triggerActive,
    verifying,
    verifyError,
  } = useTriggerScan({
    enabled: !submitting,
    onEpc: (code, item) => addEpcs([code], item ? { [code]: item } : undefined),
  });

  const summary = useMemo(() => {
    const eligible = [];
    let blocked = 0;
    let notFound = 0;
    let loading = 0;
    let failed = 0;
    epcCodes.forEach((code) => {
      const entry = info[code];
      if (!entry || entry.state === 'loading') loading += 1;
      else if (entry.state === 'notFound') notFound += 1;
      else if (entry.state === 'error') failed += 1;
      else if (BLOCKED_STATUSES.has(entry.item.status)) blocked += 1;
      else eligible.push(entry.item);
    });
    return { eligible, blocked, notFound, loading, failed };
  }, [epcCodes, info]);

  const pickPhoto = async (source) => {
    setError('');
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === 'camera' ? 'กรุณาอนุญาตให้แอปใช้กล้อง' : 'กรุณาอนุญาตให้แอปเข้าถึงคลังรูปภาพ');
      return;
    }
    const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    // expo-image-picker ~15.x ยังไม่มี mediaTypes array API — ใช้ MediaTypeOptions แบบเดียวกับหน้ารายละเอียดผ้า
    const result = await launch({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
  };

  const submit = async () => {
    const items = summary.eligible;
    const reason = buildReasonCode(reasonCode, otherText);
    setSubmitting(true);
    setError('');
    setFailures({});
    setProgress({ done: 0, total: items.length });

    const succeeded = [];
    const failed = {};
    for (const item of items) {
      try {
        // ส่งทีละชิ้น (endpoint รับทีละ id เหมือนหน้าเว็บ) ตามลำดับ ไม่ยิงขนานกันโดน rate limit
        // eslint-disable-next-line no-await-in-loop
        await decommissionFabricItem(item.id, { reasonCode: reason, photo });
        succeeded.push(item.epcCode);
      } catch (err) {
        failed[item.epcCode] = err?.message || 'ส่งคำขอไม่สำเร็จ';
      }
      setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }

    setSubmitting(false);
    // ชิ้นที่ส่งสำเร็จเอาออกจากรายการ เหลือเฉพาะชิ้นที่ล้มเหลว/ข้าม ไว้ให้แก้แล้วส่งใหม่
    succeeded.forEach((code) => seenRef.current.delete(code));
    const succeededSet = new Set(succeeded);
    setEpcCodes((prev) => prev.filter((c) => !succeededSet.has(c)));
    setFailures(failed);

    if (succeeded.length > 0) {
      setRecent((prev) =>
        [{ at: Date.now(), count: succeeded.length, reason: formatReasonCode(reason) }, ...prev].slice(0, 5)
      );
      setReasonCode('');
      setOtherText('');
      setPhoto(null);
    }

    const failCount = Object.keys(failed).length;
    if (failCount > 0) {
      setError(`ส่งสำเร็จ ${succeeded.length} ชิ้น · ไม่สำเร็จ ${failCount} ชิ้น — ดูรายการที่ขึ้นสีแดง`);
    } else {
      Alert.alert(
        'ส่งคำขอจำหน่ายแล้ว',
        `ส่งคำขอจำหน่ายผ้าชำรุด ${succeeded.length} ชิ้น — รอ admin ของโรงพยาบาลอนุมัติที่เว็บ ` +
          '(จัดการผ้าและล็อต › รายการพัก & ชำรุด) ระหว่างนี้ผ้าจะอยู่ในสถานะ "รออนุมัติแทงชำรุด"'
      );
    }
  };

  const handleSubmit = () => {
    const reasonError = validateReason(reasonCode, otherText);
    if (summary.eligible.length === 0) {
      setError('ยังไม่มีผ้าที่จำหน่ายได้ — สแกนผ้าชำรุดก่อน');
      return;
    }
    if (reasonError) {
      setError(reasonError);
      return;
    }
    if (summary.loading > 0) {
      setError('รอค้นข้อมูลผ้าให้ครบก่อน');
      return;
    }
    setError('');
    const reasonLabel = formatReasonCode(buildReasonCode(reasonCode, otherText));
    const skipped = summary.blocked + summary.notFound + summary.failed;
    Alert.alert(
      'ยืนยันจำหน่ายผ้าชำรุด',
      `ส่งคำขอจำหน่าย ${summary.eligible.length} ชิ้น\nเหตุผล: ${reasonLabel}` +
        `${photo ? '\nแนบรูป 1 รูป (ใช้กับทุกชิ้น)' : ''}` +
        `${skipped > 0 ? `\n\nข้าม ${skipped} ชิ้นที่จำหน่ายไม่ได้` : ''}`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ยืนยัน', style: 'destructive', onPress: submit },
      ]
    );
  };

  return (
    <PermissionGate perm="handheld.hold.view">
      <ScreenContainer>
        <Pressable onPress={() => router.back()} style={styles.backLink} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={brand.grey[700]} />
          <Text style={[type.body2, styles.backText]}>กลับ</Text>
        </Pressable>

        <Text style={[type.h3, styles.title]}>จำหน่ายผ้าชำรุด</Text>
        <Text style={[type.body2, styles.subtitle]}>
          สแกนผ้าชำรุดเป็นชุด เลือกเหตุผล แล้วส่งคำขอจำหน่าย — มีผลเมื่อ admin อนุมัติที่เว็บ
        </Text>

        <AppCard style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={[type.subtitle1, styles.sectionTitle, styles.flex]}>
              1. สแกนผ้าชำรุด ({epcCodes.length})
            </Text>
            {epcCodes.length > 0 ? (
              <Pressable onPress={clearAll} disabled={submitting} style={styles.clearButton} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle-outline" size={18} color={brand.primary.dark} />
                <Text style={[type.subtitle2, styles.clearLabel]}>ล้าง</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setManualVisible(true)}
              disabled={submitting}
              style={styles.cornerButton}
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
              verifying={verifying}
              verifyError={verifyError}
              idleLabel="เหนี่ยวปุ่มไกที่ตัวเครื่องเพื่อสแกนผ้าชำรุด"
            />
          ) : (
            <Text style={[type.body2, styles.muted]}>
              ยังไม่ได้เลือกเครื่องอ่าน RFID — กดปุ่มคีย์บอร์ดมุมขวาเพื่อกรอกรหัส EPC เอง
            </Text>
          )}

          {epcCodes.length === 0 ? (
            <Text style={[type.body2, styles.muted]}>ยังไม่มีรายการ</Text>
          ) : (
            <>
              <View style={styles.statRow}>
                <StatusChip label={`จำหน่ายได้ ${summary.eligible.length}`} color="success" />
                {summary.blocked > 0 ? (
                  <StatusChip label={`รออนุมัติ/จำหน่ายแล้ว ${summary.blocked}`} color="warning" />
                ) : null}
                {summary.notFound > 0 ? (
                  <StatusChip label={`ไม่พบในระบบ ${summary.notFound}`} color="error" />
                ) : null}
                {summary.loading > 0 ? (
                  <StatusChip label={`กำลังค้นหา ${summary.loading}`} color="info" />
                ) : null}
                {summary.failed > 0 ? (
                  <StatusChip label={`ค้นไม่สำเร็จ ${summary.failed}`} color="warning" />
                ) : null}
              </View>
              {summary.failed > 0 ? (
                <AppButton variant="outlined" icon="refresh" onPress={retryLookup} contentStyle={styles.smallButton}>
                  ลองค้นอีกครั้ง ({summary.failed})
                </AppButton>
              ) : null}

              <View style={styles.list}>
                {epcCodes.map((code) => (
                  <ItemRow
                    key={code}
                    epc={code}
                    entry={info[code]}
                    failure={failures[code]}
                    onRemove={submitting ? undefined : removeEpc}
                  />
                ))}
              </View>
            </>
          )}
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={[type.subtitle1, styles.sectionTitle]}>2. เหตุผลที่จำหน่าย</Text>
          <ReasonPicker
            value={reasonCode}
            onChange={(code) => {
              setReasonCode(code);
              setError('');
            }}
            otherText={otherText}
            onChangeOtherText={setOtherText}
            disabled={submitting}
          />

          <Text style={[type.subtitle2, styles.muted]}>รูปภาพประกอบ (ไม่บังคับ)</Text>
          {photo ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <Pressable onPress={() => setPhoto(null)} disabled={submitting} style={styles.photoRemove} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoActions}>
              <AppButton
                variant="soft"
                icon="camera-outline"
                onPress={() => pickPhoto('camera')}
                disabled={submitting}
                style={styles.flex}
                contentStyle={styles.smallButton}
              >
                ถ่ายรูป
              </AppButton>
              <AppButton
                variant="soft"
                icon="image-outline"
                onPress={() => pickPhoto('library')}
                disabled={submitting}
                style={styles.flex}
                contentStyle={styles.smallButton}
              >
                เลือกรูป
              </AppButton>
            </View>
          )}
        </AppCard>

        {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

        {!canEdit ? (
          <Text style={[type.body2, styles.muted]}>
            บัญชีนี้ดูได้อย่างเดียว ไม่มีสิทธิ์ส่งคำขอจำหน่าย — ติดต่อผู้ดูแลระบบให้เปิดสิทธิ์
          </Text>
        ) : null}

        <AppButton
          variant="filled"
          icon="delete-outline"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canEdit || submitting || summary.eligible.length === 0}
          buttonColor={brand.error.main}
        >
          {submitting
            ? `กำลังส่ง ${progress.done}/${progress.total}`
            : `ส่งคำขอจำหน่าย (${summary.eligible.length} ชิ้น)`}
        </AppButton>

        {recent.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={[type.subtitle2, styles.muted]}>ส่งคำขอล่าสุด (รออนุมัติที่เว็บ)</Text>
            {recent.map((entry) => (
              <AppCard key={entry.at} style={styles.historyCard}>
                <Text style={[type.body2, styles.historyText]}>
                  {entry.count} ชิ้น · {entry.reason}
                </Text>
                <Text style={[type.caption, styles.muted]}>
                  {new Date(entry.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                </Text>
              </AppCard>
            ))}
            <Text style={[type.caption, styles.muted]}>
              อนุมัติ/ปฏิเสธได้ที่เว็บ: จัดการผ้าและล็อต › รายการพัก & ชำรุด
            </Text>
          </View>
        ) : null}

        <Portal>
          <Modal
            visible={manualVisible}
            onDismiss={() => setManualVisible(false)}
            contentContainerStyle={styles.modalWrap}
          >
            <View style={styles.modalCard}>
              <Text style={[type.subtitle1, styles.sectionTitle]}>กรอกรหัส EPC (วางได้หลายรายการ)</Text>
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
                    addEpcs(parseEpcCodes(bulkEpc));
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

function ItemRow({ epc, entry, failure, onRemove }) {
  const state = entry?.state ?? 'loading';
  const item = entry?.item;
  const blocked = state === 'found' && BLOCKED_STATUSES.has(item.status);
  const bad = blocked || failure || state === 'notFound' || state === 'error';

  let title = 'กำลังค้นหา...';
  let detail = null;
  if (state === 'found') {
    title = item.categoryName || 'ไม่ระบุประเภทผ้า';
    detail = blocked
      ? `${STATUS_LABEL[item.status] ?? item.status} — ข้าม`
      : STATUS_LABEL[item.status] ?? item.status;
  } else if (state === 'notFound') {
    title = 'ไม่พบผ้ารหัสนี้ในระบบ';
  } else if (state === 'error') {
    title = 'ค้นไม่สำเร็จ';
  }
  if (failure) detail = `ส่งไม่สำเร็จ: ${failure}`;

  return (
    <View style={[styles.row, bad && styles.rowBad]}>
      <View style={styles.flex}>
        <Text style={[type.body2, styles.rowTitle, bad && styles.rowTitleBad]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[type.caption, styles.muted]} numberOfLines={2}>
          {shortEpc(epc)}
          {detail ? ` · ${detail}` : ''}
        </Text>
      </View>
      {onRemove ? (
        <Pressable onPress={() => onRemove(epc)} hitSlop={8}>
          <MaterialCommunityIcons name="close" size={18} color={bad ? brand.error.dark : brand.grey[500]} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backText: { color: brand.grey[700] },
  title: { color: brand.grey[800], marginTop: 4 },
  subtitle: { color: brand.grey[500], marginBottom: 4 },
  card: { gap: 12 },
  sectionTitle: { color: brand.grey[800] },
  muted: { color: brand.grey[500] },
  error: { color: brand.error.main },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallButton: { minHeight: 44, paddingVertical: 0 },
  list: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: brand.grey[100],
  },
  rowBad: { backgroundColor: alpha(brand.error.main, 0.1) },
  rowTitle: { color: brand.grey[800], fontWeight: '700' },
  rowTitleBad: { color: brand.error.dark },
  photoActions: { flexDirection: 'row', gap: 8 },
  photoWrap: { alignSelf: 'flex-start' },
  photo: { width: 160, height: 160, borderRadius: radius.md },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  historySection: { gap: 8 },
  historyCard: { gap: 2 },
  historyText: { color: brand.grey[800] },
  modalWrap: { padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: radius.card, padding: 20, gap: 12 },
  modalInput: { backgroundColor: '#FFFFFF', minHeight: 120 },
  modalActions: { flexDirection: 'row', gap: 8 },
});
