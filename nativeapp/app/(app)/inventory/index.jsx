import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchLocationByEpc } from '../../../src/api/operations.api';
import { AppCard } from '../../../src/components/AppCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { ScannerInput } from '../../../src/components/ScannerInput';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { StatusChip } from '../../../src/components/StatusChip';
import { STATUS_COLOR, STATUS_LABEL } from '../../../src/constants/fabric';
import { getSelectedDeviceId, NONE_DEVICE_ID } from '../../../src/rfid/deviceSettings';
import { useOrcaReader } from '../../../src/rfid/useOrcaReader';
import { brand, sage } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/theme';
import { type } from '../../../src/theme/typography';

const RFID_STATUS_LABEL = {
  connecting: 'กำลังเชื่อมต่อเครื่องอ่าน...',
  connected: 'เครื่องอ่านพร้อมใช้งาน',
  error: 'เชื่อมต่อเครื่องอ่านไม่สำเร็จ',
};

// เดิมหน้านี้โชว์ลิสต์ผ้าทั้งหมด — เปลี่ยนเป็นสแกนหาทีละชิ้นแทน (เร็วกว่าสำหรับหน้างานจริง ไม่ต้อง
// ไล่สกอลหาในลิสต์ยาวๆ) และรวมข้อมูลตำแหน่งผ้าล่าสุดมาแสดงในผลลัพธ์เดียวกันเลย (เดิมต้องไปหน้า
// "ค้นหาตำแหน่งผ้า" แยกต่างหาก) — ใช้ endpoint เดียวกับหน้านั้น (GET /tracking/location/:epc)
// เพราะ response มีทั้งสถานะผ้าและตำแหน่งอยู่แล้วในตัว
export default function InventoryScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [epc, setEpc] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rfidDeviceId, setRfidDeviceId] = useState(NONE_DEVICE_ID);
  // true ระหว่างที่กำลังเหนี่ยวปุ่มไกที่ตัวเครื่อง (มีแท็กไหลเข้ามาต่อเนื่อง) — ปล่อยไกแล้วดับเอง
  const [triggerActive, setTriggerActive] = useState(false);
  const releaseTimer = useRef(null);

  const hasRfidDevice = rfidDeviceId !== NONE_DEVICE_ID;
  const {
    status: rfidStatus,
    errorMessage: rfidErrorMessage,
    listenTags,
    cleanBuffer,
  } = useOrcaReader({ enabled: hasRfidDevice });

  useEffect(() => {
    getSelectedDeviceId().then(setRfidDeviceId);
  }, []);

  // รับ code ตรงๆ ได้ (ตอนสแกนจากเครื่องอ่าน state ยังไม่ทันอัปเดต) — ถ้าไม่ส่งมาใช้ค่าในช่องพิมพ์
  const handleSearch = async (codeArg) => {
    const code = (typeof codeArg === 'string' ? codeArg : epc).trim();
    if (!code) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await fetchLocationByEpc(code);
      setResult(data);
    } catch (err) {
      setError(err?.message || 'ไม่พบผ้ารหัสนี้');
    } finally {
      setLoading(false);
    }
  };

  // สแกนเฉพาะตอนเหนี่ยวปุ่มไกที่ตัวเครื่อง — แอปไม่สั่งอ่านเอง แค่ผูก listener ไว้ขณะอยู่หน้านี้
  // hardware trigger ของ Orca 50 เป็นตัวเริ่ม/หยุด inventory ที่ firmware (setTrigger(true) ตอน
  // connect) แท็กจะไหลเข้ามาเฉพาะช่วงที่เหนี่ยวไกค้างไว้
  const listening = hasRfidDevice && isFocused && rfidStatus === 'connected';
  useEffect(() => {
    if (!listening) return undefined;
    const onTag = (scanned) => {
      // มีแท็กเข้ามา = กำลังเหนี่ยวไกอยู่ ต่ออายุตัวจับเวลา "ปล่อยไก" ทุกครั้งที่ได้แท็ก
      setTriggerActive(true);
      clearTimeout(releaseTimer.current);
      releaseTimer.current = setTimeout(() => {
        setTriggerActive(false);
        cleanBuffer(); // ปล่อยไกแล้วล้าง buffer ให้เหนี่ยวซ้ำแท็กเดิมได้อีก
      }, 700);
      setEpc(scanned);
      handleSearch(scanned);
    };
    const unlisten = listenTags(onTag);
    return () => {
      clearTimeout(releaseTimer.current);
      setTriggerActive(false);
      if (unlisten) unlisten();
    };
    // handleSearch ปิด closure เฉพาะ setter/ค่าคงที่ ไม่ต้องใส่เป็น dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, listenTags, cleanBuffer]);

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
              <MaterialCommunityIcons name="plus-circle-outline" size={22} color={brand.primary.dark} />
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
        </View>
        {hasRfidDevice ? (
          <>
            <StatusChip
              label={
                rfidStatus === 'error'
                  ? rfidErrorMessage || RFID_STATUS_LABEL.error
                  : RFID_STATUS_LABEL[rfidStatus]
              }
              color={
                rfidStatus === 'connected' ? 'success' : rfidStatus === 'error' ? 'error' : 'info'
              }
            />

            {rfidStatus === 'connected' ? (
              <View style={[styles.triggerRow, triggerActive && styles.triggerRowActive]}>
                {triggerActive || loading ? (
                  <ActivityIndicator size="small" color={brand.primary.dark} />
                ) : (
                  <MaterialCommunityIcons
                    name="gesture-tap-button"
                    size={22}
                    color={brand.grey[500]}
                  />
                )}
                <Text
                  style={[
                    type.body2,
                    styles.triggerText,
                    triggerActive && styles.triggerTextActive,
                  ]}
                >
                  {loading
                    ? 'กำลังค้นหา...'
                    : triggerActive
                      ? 'กำลังกดปุ่มสแกน...'
                      : 'เหนี่ยวปุ่มไกที่ตัวเครื่องเพื่อสแกนผ้า'}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        <ScannerInput value={epc} onChangeText={setEpc} onSubmit={handleSearch} />
      </AppCard>

      {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

      {!loading && !result && !error ? (
        <EmptyState icon="archive-search-outline" title="กรอกหรือสแกนรหัส EPC เพื่อค้นหาผ้า" />
      ) : null}

      {result ? (
        <Pressable onPress={() => router.push(`/inventory/${result.fabricItem.epcCode}`)}>
          <AppCard style={styles.resultCard} elevated>
            <View style={styles.resultHeader}>
              <Text style={[type.h3, styles.epc]} numberOfLines={1}>
                {result.fabricItem.epcCode}
              </Text>
              <StatusChip
                label={STATUS_LABEL[result.fabricItem.status] ?? result.fabricItem.status}
                color={STATUS_COLOR[result.fabricItem.status] || 'default'}
              />
            </View>

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
    marginRight: 12,
    padding: 4,
  },
  searchCard: {
    gap: 14,
  },
  searchTitleRow: {
    flexDirection: 'row',
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
    flex: 1,
    gap: 2,
  },
  searchTitle: {
    color: brand.grey[800],
  },
  searchHint: {
    color: brand.grey[500],
  },
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.grey[200],
    backgroundColor: brand.grey[100],
  },
  triggerRowActive: {
    borderColor: brand.primary.main,
    backgroundColor: sage.tint,
  },
  triggerText: {
    flex: 1,
    color: brand.grey[600],
  },
  triggerTextActive: {
    color: sage.text,
    fontWeight: '700',
  },
  error: {
    color: brand.error.main,
  },
  resultCard: {
    gap: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  epc: {
    color: brand.grey[800],
    flexShrink: 1,
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
