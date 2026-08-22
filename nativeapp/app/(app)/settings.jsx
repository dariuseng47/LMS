import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../src/components/AppCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { NONE_DEVICE_ID, RFID_DEVICES, getSelectedDeviceId, setSelectedDeviceId } from '../../src/rfid/deviceSettings';
import { brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

export default function SettingsScreen() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(NONE_DEVICE_ID);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSelectedDeviceId()
      .then(setSelectedId)
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (deviceId) => {
    const nextId = deviceId === selectedId ? NONE_DEVICE_ID : deviceId;
    setSelectedId(nextId);
    await setSelectedDeviceId(nextId);
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
});
