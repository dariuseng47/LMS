import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';

import { useAuth } from '../../src/auth/AuthContext';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { alpha, brand, sage, surface } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

// v8 — full reset back to the app's actual design system (src/theme/*, AppCard,
// AppButton) instead of one-off custom styling. Minimal MUJI: white page, sage-green
// accents only on interactive states, a single AppCard (the same component every other
// screen uses), no gradients/glass/decoration competing for attention. The two soft blobs
// are the only ornament — quiet enough to stay "plain" while not reading as bare.
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState(null); // null | 'username' | 'password'

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
    <View style={styles.flex}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AppCard style={styles.card}>
              <Image
                source={require('../../assets/logo/welgroup-logo.jpg')}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={[type.h2, styles.title]}>เข้าสู่ระบบ</Text>
              <Text style={[type.body2, styles.subtitle]}>เข้าสู่ระบบเพื่อเริ่มใช้งาน</Text>

              <View style={styles.fields}>
                <View style={[styles.inputWrap, focusedField === 'username' && styles.inputWrapFocused]}>
                  <TextInput
                    mode="flat"
                    label="ชื่อผู้ใช้"
                    value={username}
                    onChangeText={setUsername}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    style={styles.input}
                    theme={{ colors: { background: 'transparent' } }}
                    left={
                      <TextInput.Icon
                        icon="account-outline"
                        color={focusedField === 'username' ? brand.primary.dark : brand.grey[500]}
                      />
                    }
                  />
                </View>

                <View style={[styles.inputWrap, focusedField === 'password' && styles.inputWrapFocused]}>
                  <TextInput
                    mode="flat"
                    label="รหัสผ่าน"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={secure}
                    autoCapitalize="none"
                    autoCorrect={false}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    style={styles.input}
                    theme={{ colors: { background: 'transparent' } }}
                    left={
                      <TextInput.Icon
                        icon="lock-outline"
                        color={focusedField === 'password' ? brand.primary.dark : brand.grey[500]}
                      />
                    }
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

              <AppButton
                variant="filled"
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting}
                style={styles.submit}
                contentStyle={styles.submitContent}
              >
                เข้าสู่ระบบ
              </AppButton>
            </AppCard>

            <Text style={[type.caption, styles.footer]}>
              Multi-Tenant IoT RFID Laundry Management System
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: surface.background,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: alpha(brand.primary.main, 0.06),
  },
  blobTop: {
    width: 260,
    height: 260,
    top: -110,
    right: -90,
  },
  blobBottom: {
    width: 220,
    height: 220,
    bottom: -80,
    left: -70,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  card: {
    gap: 4,
    // AppCard has a hairline border by default (used everywhere else in the app) — this
    // screen doesn't want it, so cancel it out here rather than changing the shared
    // component (that would affect every other card in the app).
    borderWidth: 0,
  },
  logo: {
    width: 220,
    height: 58,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    color: brand.grey[800],
    textAlign: 'center',
  },
  subtitle: {
    color: brand.grey[500],
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 22,
  },
  fields: {
    gap: 14,
  },
  inputWrap: {
    borderRadius: radius.sm,
    backgroundColor: brand.grey[100],
    overflow: 'hidden',
  },
  inputWrapFocused: {
    backgroundColor: sage.tint,
  },
  input: {
    height: 54,
    backgroundColor: 'transparent',
  },
  error: {
    color: brand.error.main,
    marginTop: 12,
  },
  submit: {
    marginTop: 20,
  },
  submitContent: {
    height: 48,
  },
  footer: {
    color: brand.grey[400],
    textAlign: 'center',
    marginTop: 20,
  },
});
