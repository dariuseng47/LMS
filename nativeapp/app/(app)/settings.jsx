import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../src/components/AppCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import {
  NONE_DEVICE_ID,
  READER_POWER,
  RFID_DEVICES,
  getReaderPower,
  getSelectedDeviceId,
  setReaderPower,
  setSelectedDeviceId,
} from '../../src/rfid/deviceSettings';
import { useOrcaReader } from '../../src/rfid/useOrcaReader';
import { brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

export default function SettingsScreen() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(NONE_DEVICE_ID);
  const [loading, setLoading] = useState(true);
  const [power, setPower] = useState(READER_POWER.default);

  const readerSelected = selectedId !== NONE_DEVICE_ID;
  // ต่อเครื่องอ่านตอนอยู่หน้านี้ด้วย เพื่อให้ปรับกำลังส่งแล้วเห็นผลทันที (applyPower)
  const { applyPower } = useOrcaReader({ enabled: readerSelected });

  useEffect(() => {
    getSelectedDeviceId()
      .then(setSelectedId)
      .finally(() => setLoading(false));
    getReaderPower().then(setPower);
  }, []);

  const handleSelect = async (deviceId) => {
    const nextId = deviceId === selectedId ? NONE_DEVICE_ID : deviceId;
    setSelectedId(nextId);
    await setSelectedDeviceId(nextId);
  };

  const changePower = async (next) => {
    const clamped = Math.min(READER_POWER.max, Math.max(READER_POWER.min, next));
    if (clamped === power) return;
    setPower(clamped);
    applyPower(clamped);
    await setReaderPower(clamped);
  };

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
        <MaterialCommunityIcons name="chevron-left" size={22} color={brand.grey[700]} />
        <Text style={[type.body2, styles.backLabel]}>กลับ</Text>
      </Pressable>

      <Text style={[type.h3, styles.title]}>ตั้งค่าเครื่อง</Text>
      <Text style={[type.body2, styles.subtitle]}>
        เลือกรุ่นเครื่องอ่าน RFID ที่ใช้บนมือถือเครื่องนี้ — เมื่อเลือกแล้ว หน้าลงทะเบียนผ้าด้วยการสแกน
        จะเปลี่ยนจากพิมพ์รหัส EPC เองเป็นสแกนจริงผ่านเครื่องนี้
      </Text>

      {!loading &&
        RFID_DEVICES.map((device) => {
          const active = device.id === selectedId;
          return (
            <Pressable key={device.id} onPress={() => handleSelect(device.id)}>
              <AppCard style={[styles.deviceCard, active && styles.deviceCardActive]}>
                <View style={styles.deviceIcon}>
                  <MaterialCommunityIcons name="cellphone-wireless" size={22} color={brand.primary.dark} />
                </View>
                <View style={styles.deviceText}>
                  <Text style={[type.subtitle1, styles.deviceLabel]}>{device.label}</Text>
                  <Text style={[type.caption, styles.deviceMeta]}>
                    UHF RFID ในตัวเครื่อง — Android
                  </Text>
                </View>
                {active ? (
                  <MaterialCommunityIcons name="check-circle" size={22} color={brand.primary.main} />
                ) : (
                  <MaterialCommunityIcons name="checkbox-blank-circle-outline" size={22} color={brand.grey[300]} />
                )}
              </AppCard>
            </Pressable>
          );
        })}

      {readerSelected && !loading ? (
        <AppCard style={styles.powerCard}>
          <View style={styles.powerHeader}>
            <MaterialCommunityIcons name="access-point" size={20} color={brand.primary.dark} />
            <Text style={[type.subtitle1, styles.deviceLabel]}>กำลังส่งสัญญาณอ่าน</Text>
          </View>
          <Text style={[type.caption, styles.deviceMeta]}>
            ยิ่งสูงยิ่งอ่านได้ไกลและไวขึ้น แต่กินไฟและร้อนกว่า — ถ้ารู้สึกสัญญาณอ่อน/อ่านไม่ค่อยติด
            ให้ตั้งไว้สูงสุด
          </Text>
          <View style={styles.powerRow}>
            <Pressable
              onPress={() => changePower(power - 1)}
              disabled={power <= READER_POWER.min}
              style={[styles.powerBtn, power <= READER_POWER.min && styles.powerBtnDisabled]}
              hitSlop={6}
            >
              <MaterialCommunityIcons name="minus" size={22} color={brand.grey[800]} />
            </Pressable>
            <View style={styles.powerValueWrap}>
              <Text style={[type.h3, styles.powerValue]}>{power}</Text>
              <Text style={[type.caption, styles.deviceMeta]}>dBm</Text>
            </View>
            <Pressable
              onPress={() => changePower(power + 1)}
              disabled={power >= READER_POWER.max}
              style={[styles.powerBtn, power >= READER_POWER.max && styles.powerBtnDisabled]}
              hitSlop={6}
            >
              <MaterialCommunityIcons name="plus" size={22} color={brand.grey[800]} />
            </Pressable>
          </View>
          <Text style={[type.caption, styles.hint]}>
            ช่วง {READER_POWER.min}–{READER_POWER.max} dBm (ค่าเริ่มต้น {READER_POWER.default})
          </Text>
        </AppCard>
      ) : null}

      {selectedId === NONE_DEVICE_ID && !loading ? (
        <Text style={[type.caption, styles.hint]}>
          ยังไม่ได้เลือกเครื่องอ่าน — หน้าสแกนจะใช้การพิมพ์รหัส EPC เอง (โหมดจำลอง) เหมือนเดิม
        </Text>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  backLabel: {
    color: brand.grey[700],
  },
  title: {
    color: brand.grey[800],
    marginTop: 4,
  },
  subtitle: {
    color: brand.grey[500],
    marginBottom: 4,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceCardActive: {
    borderWidth: 1,
    borderColor: brand.primary.main,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
  },
  deviceText: {
    flex: 1,
    gap: 2,
  },
  deviceLabel: {
    color: brand.grey[800],
  },
  deviceMeta: {
    color: brand.grey[500],
  },
  hint: {
    color: brand.grey[500],
  },
  powerCard: {
    gap: 10,
  },
  powerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  powerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },
  powerBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: brand.grey[100],
  },
  powerBtnDisabled: {
    opacity: 0.4,
  },
  powerValueWrap: {
    flex: 1,
    alignItems: 'center',
  },
  powerValue: {
    color: brand.grey[800],
  },
});
