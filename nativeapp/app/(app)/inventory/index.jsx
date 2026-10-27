import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchFabricItemByEpc } from '../../../src/api/fabric.api';
import { fetchLocationByEpc } from '../../../src/api/operations.api';
import { AppButton } from '../../../src/components/AppButton';
import { AppCard } from '../../../src/components/AppCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { ScannerInput } from '../../../src/components/ScannerInput';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { StatusChip } from '../../../src/components/StatusChip';
import { TriggerScanStatus } from '../../../src/components/TriggerScanStatus';
import { STATUS_COLOR, STATUS_LABEL } from '../../../src/constants/fabric';
import { useTriggerScan } from '../../../src/rfid/useTriggerScan';
import { brand, sage } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/theme';
import { type } from '../../../src/theme/typography';

// เดิมหน้านี้โชว์ลิสต์ผ้าทั้งหมด — เปลี่ยนเป็นสแกนหาทีละชิ้นแทน (เร็วกว่าสำหรับหน้างานจริง ไม่ต้อง
// ไล่สกอลหาในลิสต์ยาวๆ) และรวมข้อมูลตำแหน่งผ้าล่าสุดมาแสดงในผลลัพธ์เดียวกันเลย (เดิมต้องไปหน้า
// "ค้นหาตำแหน่งผ้า" แยกต่างหาก) — ใช้ endpoint เดียวกับหน้านั้น (GET /tracking/location/:epc)
// เพราะ response มีทั้งสถานะผ้าและตำแหน่งอยู่แล้วในตัว
export default function InventoryScreen() {
  const router = useRouter();
  const [epc, setEpc] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchingRef = useRef(false);
  const requestIdRef = useRef(0);

  // รับ code ตรงๆ ได้ (ตอนสแกนจากเครื่องอ่าน state ยังไม่ทันอัปเดต) — ถ้าไม่ส่งมาใช้ค่าในช่องพิมพ์
  const handleSearch = async (codeArg) => {
    const code = (typeof codeArg === 'string' ? codeArg : epc).trim();
    if (!code) return;
    searchingRef.current = true;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      // /tracking/location ไม่ส่งประเภทผ้ามาด้วย — ดึง /fabric-items/:epc คู่กันเพื่อเอา category_name
      // (ถ้าดึงประเภทไม่สำเร็จก็ยังแสดงผลลัพธ์ตำแหน่งได้ตามปกติ)
      const [data, details] = await Promise.all([
        fetchLocationByEpc(code),
        fetchFabricItemByEpc(code).catch(() => null),
      ]);
      if (requestId !== requestIdRef.current) return; // ผู้ใช้กดล้างระหว่างค้น — ทิ้งผลเก่า
      setResult({ ...data, categoryName: details?.fabricItem?.category_name ?? null });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err?.message || 'ไม่พบผ้ารหัสนี้');
    } finally {
      if (requestId === requestIdRef.current) {
        searchingRef.current = false;
        setLoading(false);
      }
    }
  };

  // ล้างแท็กที่สแกนไว้/ผลลัพธ์ แล้วรอสแกนใหม่ (ยกเลิกคำค้นที่ยังค้างอยู่ด้วย)
  const handleClear = () => {
    requestIdRef.current += 1;
    searchingRef.current = false;
    setLoading(false);
    setEpc('');
    setResult(null);
    setError('');
  };

  // เหนี่ยวปุ่มไกที่ตัวเครื่อง → เอา EPC แท็กแรกไปค้นสถานะ/ตำแหน่งให้อัตโนมัติ
  const { hasRfidDevice, rfidStatus, rfidErrorMessage, triggerActive } = useTriggerScan({
    // ระหว่างเหนี่ยวไกแท็กไหลเข้ามาหลายตัว — ค้นทีละรายการ ข้ามแท็กที่เข้ามาระหว่างกำลังค้นอยู่
    // (เดิมยิง request ทุกแท็กพร้อมกัน ผลลัพธ์แย่งกันทับและเครื่องหน่วง)
    onEpc: (scanned) => {
      if (searchingRef.current) return;
      setEpc(scanned);
      handleSearch(scanned);
    },
  });

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

      <AppCard style={styles.searchCard} elevated>
        <View style={styles.searchTitleRow}>
          <View style={styles.searchIcon}>
            <MaterialCommunityIcons name="barcode-scan" size={24} color={brand.primary.dark} />
          </View>
          <View style={styles.searchTitleText}>
            <Text style={[type.subtitle1, styles.searchTitle]}>สแกนเพื่อค้นหาผ้า</Text>
            <Text style={[type.body2, styles.searchHint]}>ดูสถานะและตำแหน่งล่าสุดจากรหัส EPC</Text>
          </View>
          <ScannerInput
            value={epc}
            onChangeText={setEpc}
            onSubmit={handleSearch}
            variant="button"
            submitOnConfirm
          />
        </View>
        {hasRfidDevice ? (
          <TriggerScanStatus
            status={rfidStatus}
            errorMessage={rfidErrorMessage}
            triggerActive={triggerActive}
            busy={loading}
            busyLabel="กำลังค้นหา..."
            idleLabel="เหนี่ยวปุ่มไกที่ตัวเครื่องเพื่อสแกนผ้า"
          />
        ) : null}
        {epc || result || error ? (
          <AppButton
            variant="soft"
            icon="close-circle-outline"
            onPress={handleClear}
            contentStyle={styles.clearButtonContent}
          >
            ล้าง — สแกนใหม่
          </AppButton>
        ) : null}
      </AppCard>

      {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

      {!loading && !result && !error ? (
        <EmptyState icon="archive-search-outline" title="สแกนผ้า หรือกดปุ่มคีย์บอร์ดเพื่อกรอกรหัส EPC" />
      ) : null}

      {result ? (
        <Pressable onPress={() => router.push(`/inventory/${result.fabricItem.epcCode}`)}>
          <AppCard style={styles.resultCard} elevated>
            <Text style={[type.h3, styles.categoryName]} numberOfLines={2}>
              {result.categoryName || 'ไม่ระบุประเภทผ้า'}
            </Text>
            <Text style={[type.body2, styles.epc]} numberOfLines={1}>
              {result.fabricItem.epcCode}
            </Text>

            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={sage.text} />
              <Text style={[type.subtitle1, styles.locationText]}>
                {result.location.name || 'ไม่ทราบตำแหน่งปัจจุบัน'}
              </Text>
            </View>

            {result.lastScan ? (
              <Text style={[type.body2, styles.meta]}>
                สแกนล่าสุด: {result.lastScan.event_type} —{' '}
                {new Date(result.lastScan.scanned_at).toLocaleString('th-TH')}
              </Text>
            ) : (
              <Text style={[type.body2, styles.meta]}>ยังไม่มีประวัติการสแกน</Text>
            )}

            <View style={styles.statusRow}>
              <StatusChip
                label={STATUS_LABEL[result.fabricItem.status] ?? result.fabricItem.status}
                color={STATUS_COLOR[result.fabricItem.status] || 'default'}
              />
            </View>

            <View style={styles.detailLinkRow}>
              <Text style={[type.subtitle2, styles.detailLink]}>ดูรายละเอียดเพิ่มเติม</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={brand.primary.dark} />
            </View>
          </AppCard>
        </Pressable>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  headerButtonText: {
    color: brand.primary.dark,
  },
  clearButtonContent: {
    minHeight: 44,
  },
  searchCard: {
    gap: 14,
  },
  // wrap: ตอนมี EPC ในช่อง ชิปค่าจะกว้างได้ถึง 75% — ถ้าไม่ให้ขึ้นบรรทัดใหม่ ข้อความหัวการ์ดจะถูกบีบจนกว้าง
  // เกือบ 0 แล้วตัดบรรทัดทีละตัวอักษร (เป็นจุดยาวๆ เต็มจอ)
  searchTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  searchIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
  },
  searchTitleText: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
    gap: 2,
  },
  searchTitle: {
    color: brand.grey[800],
  },
  searchHint: {
    color: brand.grey[500],
  },
  error: {
    color: brand.error.main,
  },
  resultCard: {
    gap: 12,
  },
  categoryName: {
    color: brand.grey[800],
  },
  epc: {
    color: brand.grey[500],
  },
  statusRow: {
    flexDirection: 'row',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: sage.tint,
  },
  locationText: {
    color: sage.text,
    flexShrink: 1,
  },
  meta: {
    color: brand.grey[500],
  },
  detailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  detailLink: {
    color: brand.primary.dark,
  },
});
