import { BlurView } from 'expo-blur';
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
import { TextInput } from 'react-native-paper';

import { useAuth } from '../../src/auth/AuthContext';
import { brand } from '../../src/theme/colors';
import { fontFamily, type } from '../../src/theme/typography';

// Glassmorphism + soft-UI (neumorphism) login — a deliberately more decorative "arrival"
// screen than the flat-white in-app screens. Real frosted glass via expo-blur's BlurView
// (native blur, not a CSS backdrop-filter fake), floating on a green gradient so the blur
// has something to actually blur. Soft-UI reads through generous radius + low-contrast
// extruded shadows instead of hard borders/outlines.

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
      colors={['#2FBE7C', '#8FE3B4', '#F4FBF6']}
      locations={[0, 0.45, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.flex}
    >
      <View style={[styles.orb, styles.orbTopRight]} />
      <View style={[styles.orb, styles.orbBottomLeft]} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/logo/welgroup-logo.jpg')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.glassShadowWrap}>
            <BlurView intensity={55} tint="light" style={styles.glassCard}>
              <View style={styles.glassOverlay} />

              <View style={styles.cardContent}>
                <Text style={[type.h2, styles.title]}>ยินดีต้อนรับกลับ</Text>
                <Text style={[type.body2, styles.subtitle]}>เข้าสู่ระบบเพื่อเริ่มใช้งาน</Text>

                <View style={styles.fields}>
                  <View style={styles.softInputWrap}>
                    <TextInput
                      mode="flat"
                      label="ชื่อผู้ใช้"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      underlineColor="transparent"
                      activeUnderlineColor="transparent"
                      style={styles.softInput}
                      contentStyle={styles.softInputContent}
                      theme={{ colors: { background: 'transparent' } }}
                      left={<TextInput.Icon icon="account-outline" color={brand.grey[500]} />}
                    />
                  </View>

                  <View style={styles.softInputWrap}>
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
                      style={styles.softInput}
                      contentStyle={styles.softInputContent}
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
                  style={({ pressed }) => [styles.submitShadowWrap, pressed && styles.submitPressed]}
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
                      <>
                        <Text style={styles.submitLabel}>เข้าสู่ระบบ</Text>
                        <Text style={styles.submitArrow}>→</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <Text style={[type.caption, styles.footer]}>
                  Multi-Tenant IoT RFID Laundry Management System
                </Text>
              </View>
            </BlurView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  orbTopRight: {
    width: 220,
    height: 220,
    top: -60,
    right: -60,
  },
  orbBottomLeft: {
    width: 260,
    height: 260,
    bottom: -100,
    left: -90,
    backgroundColor: 'rgba(0,75,80,0.12)',
  },
  logoBadge: {
    alignSelf: 'center',
    width: 176,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    // soft-UI extruded shadow — low-opacity, generous radius, no hard edge
    shadowColor: '#0B3D2E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  logo: {
    width: '100%',
    height: 44,
  },
  glassShadowWrap: {
    borderRadius: 32,
    shadowColor: '#0B3D2E',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 10,
  },
  glassCard: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  cardContent: {
    padding: 28,
  },
  title: {
    color: brand.grey[800],
    textAlign: 'center',
  },
  subtitle: {
    color: brand.grey[600],
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  fields: {
    gap: 16,
  },
  softInputWrap: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
    // soft embossed feel: light shadow above, nothing below — approximates a raised
    // soft-UI surface (true dual inset shadows need a dedicated shadow lib in RN)
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  softInput: {
    backgroundColor: 'transparent',
    height: 56,
  },
  softInputContent: {
    backgroundColor: 'transparent',
  },
  error: {
    color: brand.error.dark,
    marginTop: 14,
    textAlign: 'center',
  },
  submitShadowWrap: {
    borderRadius: 18,
    marginTop: 26,
    shadowColor: brand.primary.dark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  submitPressed: {
    opacity: 0.85,
  },
  submit: {
    height: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fontFamily.bold,
  },
  submitArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: fontFamily.bold,
  },
  footer: {
    color: brand.grey[600],
    textAlign: 'center',
    marginTop: 22,
  },
});
