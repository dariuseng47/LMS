import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useTriggerScan } from '../../../src/rfid/useTriggerScan';
import { brand, sage } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/theme';
import { type } from '../../../src/theme/typography';

// หน้า "สแกนค้นหาผ้า" — สแกนได้ทีละหลายชิ้น (bulk) เหนี่ยวไกค้างไว้แท็กไหลเข้ามาเรื่อย ๆ แล้วลิสต์ว่าเจอผ้า
// อะไรบ้าง (สรุปจำนวนตามประเภท + รายชิ้นพร้อมสถานะ/ตำแหน่ง) กดแต่ละชิ้นไปหน้ารายละเอียดได้
//
// แท็กที่เข้ามาถูกพักไว้ในคิวแล้วค้นรวดเดียวผ่าน POST /tracking/lookup (ทีละไม่เกิน LOOKUP_BATCH) แทน
// การยิง GET ทีละแท็ก — สแกนผ้าเป็นกองทีเดียวเป็นร้อยชิ้น ถ้ายิงทีละ request เครื่องจะหน่วงและโดน rate limit
//
// เดิมช่องค่า EPC (ScannerInput variant="button") อยู่แถวเดียวกับหัวการ์ด พอมีค่าชิปกว้างถึง 75% ทำให้
// ข้อความหัวการ์ดโดนบีบจนตัดบรรทัดทีละตัวอักษร เกิดพื้นที่ว่างสูงเต็มจอ — ตอนนี้ปุ่มคีย์บอร์ดเป็นปุ่มกลม
// ขนาดคงที่ และข้อความหัวการ์ด flex:1 จึงไม่มีทางโดนบีบอีก
const LOOKUP_BATCH = 200;
const FLUSH_DELAY_MS = 250;
const MAX_ROWS = 150; // แสดงรายชิ้นไม่เกินนี้ (สรุปตามประเภทยังนับครบทุกชิ้น) กันเครื่องหน่วงตอนสแกนเยอะมาก

function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

export default function InventoryScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { setScanReady } = useScanReady();

  const [epcs, setEpcs] = useState([]); // ลำดับที่สแกน ล่าสุดอยู่บน
  const [info, setInfo] = useState({}); // epc -> { state: 'loading' | 'found' | 'notFound' | 'error', item? }
  const [inFlight, setInFlight] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [bulkEpc, setBulkEpc] = useState('');

  const seenRef = useRef(new Set()); // กันแท็กซ้ำแบบ sync (แท็กไหลเข้าเร็วกว่า state อัปเดต)
  const queueRef = useRef([]);
  const flushTimerRef = useRef(null);
  const inFlightRef = useRef(false);
  const generationRef = useRef(0); // เพิ่มทุกครั้งที่กดล้าง — ทิ้งผลค้นที่ค้างจากรอบก่อน

  // ไฟ "พร้อมสแกน" ที่แถบล่าง — หน้านี้รับแท็กได้ตลอดเวลาที่เปิดอยู่
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
    setInFlight(true);

    let next;
    try {
      const { items = [], notFound = [] } = await lookupFabricByEpcs(batch);
      next = {};
      items.forEach((item) => {
        next[item.epcCode] = { state: 'found', item };
      });
      notFound.forEach((code) => {
        next[code] = { state: 'notFound' };
      });
      // กันกรณี server ตัด/แปลงรหัส — รหัสที่ไม่อยู่ทั้งสองฝั่งถือว่าไม่พบ
      batch.forEach((code) => {
        if (!next[code]) next[code] = { state: 'notFound' };
      });
    } catch (err) {
      next = {};
      batch.forEach((code) => {
        next[code] = { state: 'error', message: err?.message };
      });
    }

    if (generation === generationRef.current) {
      setInfo((prev) => ({ ...prev, ...next }));
    }
    inFlightRef.current = false;
    setInFlight(false);
    if (queueRef.current.length > 0) scheduleFlush(0);
  };

  const scheduleFlush = (delay = FLUSH_DELAY_MS) => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(flush, delay);
  };

  // knownItems: epc -> ข้อมูลผ้าที่ useTriggerScan เพิ่งค้นมาแล้วตอนกรองแท็กที่ลงทะเบียน — ใช้เลยไม่ต้องค้นซ้ำ
  const addEpcs = (codes, knownItems) => {
    const fresh = codes.map((c) => c.trim()).filter((c) => c && !seenRef.current.has(c));
    if (fresh.length === 0) return;
    fresh.forEach((c) => seenRef.current.add(c));
    setEpcs((prev) => [...fresh.reverse(), ...prev]);
    const toLookup = [];
    setInfo((prev) => {
      const next = { ...prev };
      fresh.forEach((c) => {
        const item = knownItems?.[c];
        next[c] = item ? { state: 'found', item } : { state: 'loading' };
      });
      return next;
    });
    fresh.forEach((c) => {
      if (!knownItems?.[c]) toLookup.push(c);
    });
    if (toLookup.length === 0) return;
    queueRef.current.push(...toLookup);
    scheduleFlush();
  };

  const removeEpc = (code) => {
    seenRef.current.delete(code);
    queueRef.current = queueRef.current.filter((c) => c !== code);
    setEpcs((prev) => prev.filter((c) => c !== code));
    setInfo((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  // ล้างทุกรายการแล้วรอสแกนใหม่ (ยกเลิกคิว/ผลค้นที่ยังค้างอยู่ด้วย)
  const handleClear = () => {
    generationRef.current += 1;
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    queueRef.current = [];
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
    // ได้เฉพาะแท็กที่ลงทะเบียนแล้ว (กรองใน useTriggerScan) — item มาด้วยถ้าเพิ่งค้นจาก server สด ๆ
    onEpc: (code, item) => addEpcs([code], item ? { [code]: item } : undefined),
  });

  const summary = useMemo(() => {
    let found = 0;
    let notFound = 0;
    let loading = 0;
    let failed = 0;
    const byCategory = new Map();
    epcs.forEach((code) => {
      const entry = info[code];
      if (!entry || entry.state === 'loading') loading += 1;
      else if (entry.state === 'notFound') notFound += 1;
      else if (entry.state === 'error') failed += 1;
      else {
        found += 1;
        const name = entry.item.categoryName || 'ไม่ระบุประเภทผ้า';
        byCategory.set(name, (byCategory.get(name) || 0) + 1);
      }
    });
    const categories = [...byCategory.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));
    return { found, notFound, loading, failed, categories };
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
            verifying={verifying}
            verifyError={verifyError}
            busy={inFlight && !triggerActive}
            busyLabel="กำลังค้นหา..."
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
              <StatusChip label={`พบ ${summary.found}`} color="success" />
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
                onOpen={() => router.push(`/inventory/${code}`)}
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
                  addEpcs(parseEpcCodes(bulkEpc));
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

function ScanResultRow({ epc, entry, onRemove, onOpen }) {
  const state = entry?.state ?? 'loading';
  const item = entry?.item;
  const found = state === 'found';

  let title = 'กำลังค้นหา...';
  if (found) title = item.categoryName || 'ไม่ระบุประเภทผ้า';
  else if (state === 'notFound') title = 'ไม่พบผ้ารหัสนี้ในระบบ';
  else if (state === 'error') title = 'ค้นไม่สำเร็จ';

  return (
    <Pressable onPress={found ? onOpen : undefined} disabled={!found}>
      <AppCard style={[styles.rowCard, !found && state !== 'loading' && styles.rowCardMissing]}>
        <View style={styles.rowTop}>
          <View style={styles.flex}>
            <Text
              style={[type.subtitle1, found ? styles.dark : state === 'loading' ? styles.muted : styles.errorText]}
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

        {found ? (
          <>
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color={sage.text} />
              <Text style={[type.body2, styles.locationText]} numberOfLines={2}>
                {item.locationName || 'ไม่ทราบตำแหน่งปัจจุบัน'}
              </Text>
            </View>
            <View style={styles.rowBottom}>
              <StatusChip
                label={STATUS_LABEL[item.status] ?? item.status}
                color={STATUS_COLOR[item.status] || 'default'}
              />
              <View style={styles.flex} />
              <Text style={[type.caption, styles.detailLink]}>รายละเอียด</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={brand.primary.dark} />
            </View>
          </>
        ) : null}
      </AppCard>
    </Pressable>
  );
}

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
