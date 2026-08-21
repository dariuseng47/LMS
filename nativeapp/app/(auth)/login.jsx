import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';

import { useAuth } from '../../src/auth/AuthContext';
import { brand } from '../../src/theme/colors';
import { fontFamily, type } from '../../src/theme/typography';

// v6 — glassmorphism via plain translucency instead of BlurView. expo-blur's Android
// support was unreliable on the target device (see git history), but since the backdrop
// here is a smooth gradient with no texture/detail, a translucent white card alone reads
// as convincing "frosted glass" — blur only matters when there's something busy behind it
// to soften, and there isn't. Zero dependency on native blur, renders identically on
// every device.
//
// Shadow + overflow:hidden must never sit on the same view — on Android that renders as
// a flat grey box instead of a soft shadow. Every shadowed shape here is split into an
// outer non-clipping wrapper (shadow only) and an inner view (overflow:hidden only). The
// badge's colored ring is a real borderWidth/borderColor on one view — not two offset
// shapes stacked (that produced a hard-edged "sticker frame" artifact last time).
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await signIn({ username: username.trim(), password });
    } catch (err) {
      setError(err?.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้/รหัสผ่าน');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0EA5A0', '#5EE0A8', '#B8F1C2', '#FFE7B8']}
      locations={[0, 0.35, 0.68, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.flex}
    >
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.badgeShadow}>
              <View style={styles.badge}>
                <Image
                  source={require('../../assets/logo/welgroup-logo.jpg')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>

            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <LinearGradient
                  colors={[brand.primary.main, '#5EE0A8', '#FFE7B8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cardAccent}
                />

                <View style={styles.cardContent}>
                  <Text style={[type.h2, styles.title]}>ยินดีต้อนรับ 👋</Text>
                  <Text style={[type.body2, styles.subtitle]}>เข้าสู่ระบบเพื่อเริ่มใช้งาน</Text>

                  <View style={styles.fields}>
                    <View style={styles.inputWrap}>
                      <TextInput
                        mode="flat"
                        label="ชื่อผู้ใช้"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                        underlineColor="transparent"
                        activeUnderlineColor="transparent"
                        style={styles.input}
                        theme={{ colors: { background: 'transparent' } }}
                        left={<TextInput.Icon icon="account-outline" color={brand.grey[500]} />}
                      />
                    </View>

                    <View style={styles.inputWrap}>
                      <TextInput
                        mode="flat"
                        label="รหัสผ่าน"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={secure}
                        autoCapitalize="none"
                        autoCorrect={false}
                        underlineColor="transparent"
                        activeUnderlineColor="transparent"
                        style={styles.input}
                        theme={{ colors: { background: 'transparent' } }}
                        left={<TextInput.Icon icon="lock-outline" color={brand.grey[500]} />}
                        right={
                          <TextInput.Icon
                            icon={secure ? 'eye-outline' : 'eye-off-outline'}
                            onPress={() => setSecure((prev) => !prev)}
                            color={brand.grey[500]}
                          />
                        }
                      />
                    </View>
                  </View>

                  {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

                  <Pressable
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={({ pressed }) => [styles.submitShadow, pressed && styles.pressed]}
                  >
                    <LinearGradient
                      colors={[brand.primary.light, brand.primary.main]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submit}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.submitLabel}>เข้าสู่ระบบ</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.spacer} />

            <Text style={[type.caption, styles.footer]}>
              Multi-Tenant IoT RFID Laundry Management System
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  // Shadow wrapper — separate from the white badge below so overflow:hidden on the badge
  // (needed to clip the logo image to its rounded corners) never sits next to shadow props.
  badgeShadow: {
    alignSelf: 'center',
    borderRadius: 24,
    marginBottom: 28,
    shadowColor: brand.grey[800],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(94,224,168,0.55)',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  // Shadow on the outer wrapper only — the inner card clips (overflow:hidden) its own
  // rounded corners. Never combine shadow + overflow:hidden on one view (see header).
  cardShadow: {
    borderRadius: 28,
    shadowColor: brand.grey[800],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  card: {
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  cardAccent: {
    height: 5,
  },
  cardContent: {
    padding: 24,
  },
  title: {
    color: brand.grey[800],
  },
  subtitle: {
    color: brand.grey[500],
    marginTop: 2,
    marginBottom: 24,
  },
  fields: {
    gap: 14,
  },
  inputWrap: {
    borderRadius: 18,
    backgroundColor: brand.grey[100],
    overflow: 'hidden',
  },
  input: {
    height: 56,
  },
  error: {
    color: brand.error.main,
    marginTop: 12,
  },
  submitShadow: {
    borderRadius: 999,
    marginTop: 22,
    shadowColor: brand.primary.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  pressed: {
    opacity: 0.88,
  },
  submit: {
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fontFamily.bold,
  },
  spacer: {
    flex: 1,
    minHeight: 24,
  },
  footer: {
    color: brand.grey[700],
    opacity: 0.5,
    textAlign: 'center',
  },
});
