import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Modal, Portal, TextInput } from 'react-native-paper';

import { fetchDevices } from '../../../src/api/devices.api';
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
  const [bindMode, setBindMode] = useState('lot'); // 'lot' | 'category' — ผูกล็อต หรือระบุแค่ประเภท
  const [lotId, setLotId] = useState(null);
  const [groupKey, setGroupKey] = useState('all'); // ตัวกรองหมวดหมู่ ('all' = ทุกหมวด, 'none' = ประเภทที่ยังไม่จัดหมวดหมู่)
  const [categoryId, setCategoryId] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [session, setSession] = useState(null); // { id, status, ... }
  const [bulkEpc, setBulkEpc] = useState('');
  const [manualVisible, setManualVisible] = useState(false);
  const [epcCodes, setEpcCodes] = useState([]);
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
  // group_id/group_name ที่ API ประเภทผ้าแนบมาให้ ใช้เป็นแค่ตัวกรองให้หาประเภทง่ายขึ้น ไม่บังคับเลือก
  const groups = [{ key: 'all', name: 'ทั้งหมด' }];
  categories.forEach((category) => {
    const key = category.group_id ?? 'none';
    if (!groups.some((g) => g.key === key)) {
      groups.push({ key, name: category.group_name || 'ไม่ระบุหมวดหมู่' });
    }
  });
  const groupCategories =
    groupKey === 'all'
      ? categories
      : categories.filter((category) => (category.group_id ?? 'none') === groupKey);

  const selectGroup = (key) => {
    setGroupKey(key);
    if (key !== 'all' && !categories.some((c) => c.id === categoryId && (c.group_id ?? 'none') === key)) {
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
    } catch (err) {
      setError(err?.message || 'เริ่ม session ไม่สำเร็จ');
    } finally {
      setTriggering(false);
    }
  };

  const addBulkEpcs = () => {
    const codes = parseEpcCodes(bulkEpc);
    if (codes.length === 0) return;
    setEpcCodes((prev) => [...new Set([...prev, ...codes])]);
    setBulkEpc('');
  };

  const removeEpc = (code) => {
    setEpcCodes((prev) => prev.filter((c) => c !== code));
  };

  const addEpcIfNew = (code) => {
    setEpcCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
  };

  // เหนี่ยวปุ่มไกที่ตัวเครื่อง → เพิ่มแท็กเข้ารายการเตรียมส่ง (เปิดฟังเฉพาะช่วงที่ยังเก็บ EPC อยู่)
  const { hasRfidDevice, rfidStatus, rfidErrorMessage, triggerActive } = useTriggerScan({
    enabled: !!session && session?.status !== 'REPORTED',
    onEpc: addEpcIfNew,
  });

  const handleReport = async () => {
    if (epcCodes.length === 0) {
      setError('กรุณาเพิ่มรหัส EPC อย่างน้อย 1 รายการ');
      return;
    }
    setError('');
    setReporting(true);
    try {
      await reportScanSession(session.id, { epcCodes });
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
    setLotId(null);
    setCategoryId(null);
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
                { key: 'category', label: 'ไม่ผูกล็อต (เลือกประเภท)' },
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
              <>
                <Text style={[type.subtitle2, styles.label]}>ประเภทผ้า</Text>
                {categories.length === 0 ? (
                  <Text style={[type.body2, styles.label]}>ยังไม่มีประเภทผ้าในระบบ</Text>
                ) : groups.length > 2 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {groups.map((group) => (
                        <Pressable
                          key={group.key}
                          onPress={() => selectGroup(group.key)}
                          style={[styles.filterChip, groupKey === group.key && styles.filterChipActive]}
                        >
                          <Text
                            style={[
                              type.body2,
                              styles.chipLabel,
                              groupKey === group.key && styles.chipLabelActive,
                            ]}
                          >
                            {group.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                ) : null}
                {categories.length > 0 ? (
                  <View style={styles.chipRow}>
                    {groupCategories.map((category) => (
                      <Pressable
                        key={category.id}
                        onPress={() => setCategoryId(category.id)}
                        style={[styles.chip, categoryId === category.id && styles.chipActive]}
                      >
                        <Text
                          style={[
                            type.body2,
                            styles.chipLabel,
                            categoryId === category.id && styles.chipLabelActive,
                          ]}
                        >
                          {category.name}
                        </Text>
                      </Pressable>
                    ))}
                    {groupCategories.length === 0 ? (
                      <Text style={[type.body2, styles.label]}>ไม่มีประเภทผ้าในหมวดหมู่นี้</Text>
                    ) : null}
                  </View>
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
            <Text style={[type.subtitle2, styles.label]}>
              รายการที่ {isReported ? 'ส่งไปแล้ว' : 'เตรียมส่ง'} ({epcCodes.length})
            </Text>
            {epcCodes.length === 0 ? (
              <Text style={[type.body2, styles.label]}>ยังไม่มีรายการ</Text>
            ) : (
              <View style={styles.chipRow}>
                {epcCodes.map((code) => (
                  <View key={code} style={styles.epcChip}>
                    <Text style={[type.caption, styles.epcChipLabel]}>{code}</Text>
                    {!isReported && (
                      <Pressable onPress={() => removeEpc(code)} hitSlop={6}>
                        <MaterialCommunityIcons name="close" size={14} color={sage.text} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </AppCard>

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
                disabled={reporting}
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
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: brand.grey[100],
  },
  filterChipActive: {
    backgroundColor: sage.tint,
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
});
