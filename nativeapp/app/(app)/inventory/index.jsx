import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Modal, Portal, TextInput } from 'react-native-paper';

import { lookupFabricByEpcs } from '../../../src/api/operations.api';
import { AppButton } from '../../../src/components/AppButton';
import { AppCard } from '../../../src/components/AppCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { StatusChip } from '../../../src/components/StatusChip';
import { TriggerScanStatus } from '../../../src/components/TriggerScanStatus';
import { STATUS_COLOR, STATUS_LABEL } from '../../../src/constants/fabric';
import { useScanReady } from '../../../src/context/ScanReadyContext';
import { createEpcBatchQueue } from '../../../src/rfid/epcBatchQueue';
import { peekCachedFabricItem, rememberFabricLookup } from '../../../src/rfid/registeredTagFilter';
import { useTriggerScan } from '../../../src/rfid/useTriggerScan';
import { brand, sage } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/theme';
import { type } from '../../../src/theme/typography';

// หน้า "สแกนค้นหาผ้า" — สแกนได้ทีละหลายชิ้น (bulk) เหนี่ยวไกค้างไว้แท็กไหลเข้ามาเรื่อย ๆ แล้วลิสต์ว่าเจอผ้า
// อะไรบ้าง (สรุปจำนวนตามประเภท + รายชิ้นพร้อมสถานะ/ตำแหน่ง) กดแต่ละชิ้นไปหน้ารายละเอียดได้
//
// "ลิสต์ก่อน ตรวจทีหลัง": แท็กที่อ่านได้ขึ้นรายการทันที (สถานะ "รอตรวจสอบ") แล้วค่อยทยอยส่งไปตรวจกับ
// server เบื้องหลังผ่าน createEpcBatchQueue (POST /tracking/lookup ทีละก้อน ≤ 200 ไม่ยิงซ้อน) ว่า
// ลงทะเบียนแล้วหรือยัง / เป็นผ้าประเภทไหน / สถานะ-ตำแหน่งตอนนี้ — เดิมแท็กต้องรอตรวจผ่านตัวกรองใน
// useTriggerScan ก่อนถึงจะขึ้นจอ สแกนกองใหญ่ ๆ เลยดูเหมือนแอปค้าง
//
// แท็กที่เคยค้นไว้ภายใน 5 นาที (cache ใน registeredTagFilter.js) โชว์ประเภทผ้าได้ทันทีระหว่างรอผลสด
// แต่สถานะ/ตำแหน่งยังค้นสดใหม่ทุกครั้งเสมอ — ผ้าอาจถูกสแกนผ่านจุดอื่น (รับผ้า/จ่ายวอร์ด/เปลี่ยนสถานะ) ไปแล้ว
//
// แท็กจากเครื่องอ่านไหลเข้ามาถี่มาก — พักไว้ใน ref แล้ว setState รวมทีเดียวทุก TAG_FLUSH_MS
// (setState ทุกแท็ก = render รายการทั้งหน้าใหม่หลายร้อยรอบ เครื่อง handheld หน่วงหนัก)
const TAG_FLUSH_MS = 150;
const MAX_ROWS = 150; // แสดงรายชิ้นไม่เกินนี้ (สรุปตามประเภทยังนับครบทุกชิ้น) กันเครื่องหน่วงตอนสแกนเยอะมาก

function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

// ผล lookup -> { [epc]: item } ให้คิวกระจายผลกลับเป็นราย EPC (ไม่อยู่ใน object = ไม่พบในระบบ)
async function fetchLookupBatch(codes) {
  const { items = [], notFound = [] } = await lookupFabricByEpcs(codes);
  rememberFabricLookup(items, notFound);
  const byEpc = {};
  items.forEach((item) => {
    byEpc[item.epcCode] = item;
  });
  return byEpc;
}

export default function InventoryScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { setScanReady } = useScanReady();

  const [epcs, setEpcs] = useState([]); // ลำดับที่สแกน ล่าสุดอยู่บน
  // epc -> { state: 'pending' | 'found' | 'notFound' | 'error', item?, stale? }
  //   pending + item (stale) = เคยค้นไว้ใน cache โชว์ประเภทผ้าก่อน กำลังค้นสถานะ/ตำแหน่งล่าสุด
  const [info, setInfo] = useState({});
  const [pendingCount, setPendingCount] = useState(0); // แท็กที่ยังรอตรวจกับ server
  const [manualVisible, setManualVisible] = useState(false);
  const [bulkEpc, setBulkEpc] = useState('');

  const seenRef = useRef(new Set()); // กันแท็กซ้ำแบบ sync (แท็กไหลเข้าเร็วกว่า state อัปเดต)
  const incomingRef = useRef([]); // แท็กที่รับมาแล้วแต่ยังไม่ flush เข้า state
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
            next[code] = { ...prev[code], state: 'error', message: err?.message };
          });
          return next;
        });
      },
    });
  }

  // ไฟ "พร้อมสแกน" ที่แถบล่าง — หน้านี้รับแท็กได้ตลอดเวลาที่เปิดอยู่
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

  // ย้ายแท็กที่พักไว้เข้ารายการทีเดียว + ส่งเข้าคิวตรวจ
  const flushIncoming = () => {
    flushTimerRef.current = null;
    const fresh = incomingRef.current;
    incomingRef.current = [];
    if (fresh.length === 0) return;

    setEpcs((prev) => [...fresh.slice().reverse(), ...prev]);
    setInfo((prev) => {
      const next = { ...prev };
      fresh.forEach((code) => {
        const cached = peekCachedFabricItem(code);
        next[code] = cached ? { state: 'pending', item: cached, stale: true } : { state: 'pending' };
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
    if (immediate) {
      clearTimeout(flushTimerRef.current);
      flushIncoming();
    } else if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flushIncoming, TAG_FLUSH_MS);
    }
  };

  const removeEpc = useCallback((code) => {
    seenRef.current.delete(code);
    incomingRef.current = incomingRef.current.filter((c) => c !== code);
    queueRef.current?.remove(code);
    setEpcs((prev) => prev.filter((c) => c !== code));
    setInfo((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  }, []);

  const openDetail = useCallback((code) => router.push(`/inventory/${code}`), [router]);

  // ล้างทุกรายการแล้วรอสแกนใหม่ (ยกเลิกคิว/ผลค้นที่ยังค้างอยู่ด้วย)
  const handleClear = () => {
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    incomingRef.current = [];
    queueRef.current.clear();
    seenRef.current = new Set();
    setEpcs([]);
    setInfo({});
  };

  const retryFailed = () => {
    const failed = epcs.filter((c) => info[c]?.state === 'error');
    if (failed.length === 0) return;
    setInfo((prev) => {
      const next = { ...prev };
      failed.forEach((c) => {
        next[c] = { ...prev[c], state: 'pending' };
      });
      return next;
    });
    queueRef.current.push(failed);
  };

  // registeredOnly: false — รับทุกแท็กเข้ารายการทันที แล้วหน้านี้ตรวจเองผ่านคิว (ดูคอมเมนต์ด้านบน)
  const { hasRfidDevice, rfidStatus, rfidErrorMessage, triggerActive } = useTriggerScan({
    registeredOnly: false,
    onEpc: (code) => addEpcs([code]),
  });

  const summary = useMemo(() => {
    let found = 0;
    let notFound = 0;
    let waiting = 0;
    let failed = 0;
    const byCategory = new Map();
    epcs.forEach((code) => {
      const entry = info[code];
      const item = entry?.item;
      if (entry?.state === 'notFound') notFound += 1;
      else if (entry?.state === 'error' && !item) failed += 1;
      else if (!item) waiting += 1;
      else {
        // found หรือ pending/error ที่มีข้อมูลจาก cache — ลงทะเบียนแล้วแน่ ๆ นับตามประเภทได้เลย
        found += 1;
        const name = item.categoryName || 'ไม่ระบุประเภทผ้า';
        byCategory.set(name, (byCategory.get(name) || 0) + 1);
      }
      if (entry?.state === 'error' && item) failed += 1;
    });
    const categories = [...byCategory.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));
    return { found, notFound, waiting, failed, categories };
  }, [epcs, info]);

  const visibleEpcs = epcs.slice(0, MAX_ROWS);

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/inventory/register')}
              style={styles.headerButton}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color={brand.primary.dark} />
              <Text style={[type.subtitle2, styles.headerButtonText]}>เพิ่มผ้าเข้าระบบ</Text>
            </Pressable>
          ),
        }}
      />

      <AppCard style={styles.card} elevated>
        <View style={styles.titleRow}>
          <View style={styles.searchIcon}>
            <MaterialCommunityIcons name="barcode-scan" size={24} color={brand.primary.dark} />
          </View>
          <View style={styles.titleText}>
            <Text style={[type.subtitle1, styles.dark]}>สแกนเพื่อค้นหาผ้า</Text>
            <Text style={[type.body2, styles.muted]}>สแกนได้ทีละหลายชิ้น — ดูประเภท สถานะ และตำแหน่ง</Text>
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
            busy={pendingCount > 0 && !triggerActive}
            busyLabel={`กำลังตรวจสอบแท็กกับระบบ... เหลือ ${pendingCount} ชิ้น`}
            idleLabel="เหนี่ยวปุ่มไกค้างไว้แล้วกวาดผ่านกองผ้าเพื่อสแกนหลายชิ้น"
          />
        ) : (
          <Text style={[type.body2, styles.muted]}>
            ยังไม่ได้เลือกเครื่องอ่าน RFID — กดปุ่มคีย์บอร์ดมุมขวาเพื่อกรอกรหัส EPC เอง
          </Text>
        )}
      </AppCard>

      {epcs.length === 0 ? (
        <EmptyState icon="archive-search-outline" title="สแกนผ้า หรือกดปุ่มคีย์บอร์ดเพื่อกรอกรหัส EPC" />
      ) : (
        <>
          <AppCard style={styles.card} elevated>
            <View style={styles.headerRow}>
              <Text style={[type.subtitle1, styles.dark, styles.flex]}>สแกนแล้ว {epcs.length} ชิ้น</Text>
              <Pressable onPress={handleClear} style={styles.clearButton} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle-outline" size={18} color={brand.primary.dark} />
                <Text style={[type.subtitle2, styles.clearLabel]}>ล้าง</Text>
              </Pressable>
            </View>

            <View style={styles.statRow}>
              <StatusChip label={`ลงทะเบียนแล้ว ${summary.found}`} color="success" />
              {summary.notFound > 0 ? (
                <StatusChip label={`ยังไม่ลงทะเบียน ${summary.notFound}`} color="error" />
              ) : null}
              {summary.waiting > 0 ? (
                <StatusChip label={`รอตรวจสอบ ${summary.waiting}`} color="info" />
              ) : null}
              {summary.failed > 0 ? (
                <StatusChip label={`ค้นไม่สำเร็จ ${summary.failed}`} color="warning" />
              ) : null}
            </View>

            {summary.failed > 0 ? (
              <AppButton variant="outlined" icon="refresh" onPress={retryFailed} contentStyle={styles.smallButton}>
                ลองค้นอีกครั้ง ({summary.failed})
              </AppButton>
            ) : null}

            {summary.categories.length > 0 ? (
              <View style={styles.categoryList}>
                {summary.categories.map((row) => (
                  <View key={row.name} style={styles.categoryRow}>
                    <Text style={[type.body1, styles.categoryName]} numberOfLines={2}>
                      {row.name}
                    </Text>
                    <Text style={[type.subtitle1, styles.categoryCount]}>{row.count} ชิ้น</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </AppCard>

          <View style={styles.list}>
            {visibleEpcs.map((code) => (
              <ScanResultRow
                key={code}
                epc={code}
                entry={info[code]}
                onRemove={removeEpc}
                onOpen={openDetail}
              />
            ))}
            {epcs.length > MAX_ROWS ? (
              <Text style={[type.body2, styles.muted]}>
                …และอีก {epcs.length - MAX_ROWS} ชิ้น (นับรวมในสรุปด้านบนแล้ว)
              </Text>
            ) : null}
          </View>

          <AppButton variant="soft" icon="close-circle-outline" onPress={handleClear}>
            ล้างทั้งหมด — สแกนใหม่
          </AppButton>
        </>
      )}

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
                ค้นหา
              </AppButton>
            </View>
          </View>
        </Modal>
      </Portal>
    </ScreenContainer>
  );
}

// memo — รายการยาวหลักร้อย แต่ละรอบที่ผลตรวจกลับมาเปลี่ยนแค่บางแถว แถวอื่นไม่ต้อง render ใหม่
// (entry ของแถวที่ไม่เปลี่ยนเป็น object เดิม, onRemove/onOpen เป็น useCallback)
const ScanResultRow = memo(function ScanResultRow({ epc, entry, onRemove, onOpen }) {
  const state = entry?.state ?? 'pending';
  const item = entry?.item;
  const fresh = state === 'found'; // ข้อมูลสดจาก server รอบนี้
  const registered = !!item; // found หรือรู้จากผลค้นก่อนหน้า (cache) ว่าลงทะเบียนแล้ว
  const waiting = state === 'pending' && !item;

  let title = 'รอตรวจสอบ...';
  if (registered) title = item.categoryName || 'ไม่ระบุประเภทผ้า';
  else if (state === 'notFound') title = 'ยังไม่ลงทะเบียนในระบบ';
  else if (state === 'error') title = 'ตรวจสอบไม่สำเร็จ';

  return (
    <Pressable onPress={registered ? () => onOpen(epc) : undefined} disabled={!registered}>
      <AppCard style={[styles.rowCard, !registered && !waiting && styles.rowCardMissing]}>
        <View style={styles.rowTop}>
          <View style={styles.flex}>
            <Text
              style={[type.subtitle1, registered ? styles.dark : waiting ? styles.muted : styles.errorText]}
              numberOfLines={2}
            >
              {title}
            </Text>
            <Text style={[type.caption, styles.muted]} numberOfLines={1} ellipsizeMode="middle">
              {epc}
            </Text>
          </View>
          <Pressable onPress={() => onRemove(epc)} hitSlop={10} style={styles.removeButton}>
            <MaterialCommunityIcons name="close" size={18} color={brand.grey[500]} />
          </Pressable>
        </View>

        {registered ? (
          <>
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color={sage.text} />
              <Text style={[type.body2, fresh ? styles.locationText : styles.muted]} numberOfLines={2}>
                {fresh
                  ? item.locationName || 'ไม่ทราบตำแหน่งปัจจุบัน'
                  : state === 'error'
                    ? 'โหลดสถานะ/ตำแหน่งล่าสุดไม่สำเร็จ'
                    : 'กำลังโหลดสถานะ/ตำแหน่งล่าสุด...'}
              </Text>
            </View>
            <View style={styles.rowBottom}>
              {fresh ? (
                <StatusChip
                  label={STATUS_LABEL[item.status] ?? item.status}
                  color={STATUS_COLOR[item.status] || 'default'}
                />
              ) : null}
              <View style={styles.flex} />
              <Text style={[type.caption, styles.detailLink]}>รายละเอียด</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={brand.primary.dark} />
            </View>
          </>
        ) : null}
      </AppCard>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dark: { color: brand.grey[800] },
  muted: { color: brand.grey[500] },
  errorText: { color: brand.error.dark },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: sage.tint,
  },
  headerButtonText: { color: brand.primary.dark },
  card: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
  },
  titleText: { flex: 1, minWidth: 0, gap: 2 },
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
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallButton: { minHeight: 44 },
  categoryList: {
    borderRadius: radius.md,
    backgroundColor: sage.tint,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  categoryName: { flex: 1, color: sage.text },
  categoryCount: { color: sage.text },
  list: { gap: 10 },
  rowCard: { gap: 10, padding: 14 },
  rowCardMissing: { borderWidth: 1, borderColor: brand.error.light ?? brand.error.main },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  removeButton: { padding: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { flex: 1, color: sage.text },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailLink: { color: brand.primary.dark },
  modalWrap: { paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: radius.card, padding: 20, gap: 16 },
  modalInput: { backgroundColor: '#FFFFFF', minHeight: 110, borderRadius: radius.sm },
  modalActions: { flexDirection: 'row', gap: 10 },
});
