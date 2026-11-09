import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { alpha, brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';
import {
  APK_DOWNLOAD_URL,
  CURRENT_BUILD,
  CURRENT_VERSION,
  formatBuild,
  useAppUpdate,
} from '../../src/update/AppUpdateContext';

// เมนู "อัปเดตแอป" — ดูเวอร์ชันที่ติดตั้งอยู่เทียบกับไฟล์ล่าสุดบน server แล้วกดโหลดได้
// ปุ่มดาวน์โหลดเปิดลิงก์ apk ในเบราว์เซอร์ของเครื่อง → โหลดเสร็จกดเปิดไฟล์เพื่อติดตั้งทับ (ข้อมูลเดิมยังอยู่)
// เปิดให้ทุกคนเข้าได้ ไม่ผูกสิทธิ์เมนู
export default function AppUpdateScreen() {
  const router = useRouter();
  const { latest, checking, error, lastCheckedAt, updateAvailable, check } = useAppUpdate();

  const latestLabel = latest
    ? formatBuild(latest.build) || new Date(latest.updatedAt).toLocaleString('th-TH')
    : null;

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()} style={styles.backLink} hitSlop={8}>
        <MaterialCommunityIcons name="chevron-left" size={20} color={brand.grey[700]} />
        <Text style={[type.body2, styles.backText]}>กลับ</Text>
      </Pressable>

      <Text style={[type.h3, styles.title]}>อัปเดตแอป</Text>

      {updateAvailable ? (
        <View style={[styles.banner, styles.bannerNew]}>
          <MaterialCommunityIcons name="alert-decagram" size={24} color={brand.error.dark} />
          <View style={styles.flex}>
            <Text style={[type.subtitle1, styles.bannerNewTitle]}>มีแอปเวอร์ชันใหม่</Text>
            <Text style={[type.body2, styles.bannerNewText]}>กดดาวน์โหลดด้านล่างแล้วติดตั้งทับแอปเดิม</Text>
          </View>
        </View>
      ) : latest && !error ? (
        <View style={[styles.banner, styles.bannerOk]}>
          <MaterialCommunityIcons name="check-decagram" size={24} color={sage.text} />
          <Text style={[type.subtitle1, styles.bannerOkText, styles.flex]}>ใช้เวอร์ชันล่าสุดอยู่แล้ว</Text>
        </View>
      ) : null}

      <AppCard style={styles.card}>
        <InfoRow
          label="เวอร์ชันที่ติดตั้งอยู่"
          value={`${CURRENT_VERSION}${CURRENT_BUILD ? ` · build ${formatBuild(CURRENT_BUILD)}` : ''}`}
        />
        <View style={styles.divider} />
        <InfoRow
          label="เวอร์ชันล่าสุดบน server"
          value={
            latest
              ? `${latestLabel}${latest.size ? ` · ${(latest.size / (1024 * 1024)).toFixed(1)} MB` : ''}`
              : checking
                ? 'กำลังตรวจสอบ...'
                : 'ยังไม่มีไฟล์แอปบน server'
          }
          note={latest?.fileName}
        />
        {lastCheckedAt ? (
          <Text style={[type.caption, styles.muted]}>
            ตรวจสอบล่าสุด {lastCheckedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : null}
      </AppCard>

      {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

      <AppButton
        variant={updateAvailable ? 'filled' : 'soft'}
        icon="download"
        onPress={() => Linking.openURL(APK_DOWNLOAD_URL)}
        disabled={!latest}
      >
        {updateAvailable ? 'ดาวน์โหลดเวอร์ชันใหม่' : 'ดาวน์โหลดแอปอีกครั้ง'}
      </AppButton>
      <AppButton variant="text" icon="refresh" onPress={check} loading={checking} disabled={checking}>
        ตรวจสอบอีกครั้ง
      </AppButton>

      <AppCard style={styles.card}>
        <Text style={[type.subtitle2, styles.dark]}>วิธีติดตั้ง</Text>
        <Text style={[type.body2, styles.steps]}>
          1. กดดาวน์โหลด — เครื่องจะเปิดเบราว์เซอร์แล้วโหลดไฟล์ .apk{'\n'}
          2. โหลดเสร็จ กดที่การแจ้งเตือนหรือเปิดไฟล์จากโฟลเดอร์ดาวน์โหลด{'\n'}
          3. ถ้าเครื่องถาม ให้อนุญาต "ติดตั้งแอปจากแหล่งที่ไม่รู้จัก"{'\n'}
          4. กดติดตั้ง (อัปเดตทับแอปเดิม ข้อมูลและการตั้งค่ายังอยู่)
        </Text>
      </AppCard>
    </ScreenContainer>
  );
}

function InfoRow({ label, value, note }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[type.caption, styles.muted]}>{label}</Text>
      <Text style={[type.subtitle1, styles.dark]}>{value}</Text>
      {note ? (
        <Text style={[type.caption, styles.muted]} numberOfLines={1} ellipsizeMode="middle">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dark: { color: brand.grey[800] },
  muted: { color: brand.grey[500] },
  error: { color: brand.error.main },
  backLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backText: { color: brand.grey[700] },
  title: { color: brand.grey[800], marginTop: 4 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
  },
  bannerNew: { backgroundColor: alpha(brand.error.main, 0.12) },
  bannerNewTitle: { color: brand.error.dark },
  bannerNewText: { color: brand.error.dark },
  bannerOk: { backgroundColor: sage.tint },
  bannerOkText: { color: sage.text },
  card: { gap: 12 },
  divider: { height: 1, backgroundColor: brand.grey[200] },
  infoRow: { gap: 2 },
  steps: { color: brand.grey[600], lineHeight: 26 },
});
