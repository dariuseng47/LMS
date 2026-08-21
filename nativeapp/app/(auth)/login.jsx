import { BlurView } from 'expo-blur';
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
import { TextInput } from 'react-native-paper';

import { useAuth } from '../../src/auth/AuthContext';
import { AppButton } from '../../src/components/AppButton';
import { alpha, brand, surface } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

// Minimal, clean glassmorphism — restrained version of the previous pass. One quiet
// frosted panel (real native blur via expo-blur) on an almost-flat white page; the only
// color is two very low-opacity sage blobs, just enough for the glass to have something
// to differentiate from. No stacked shadows, no gradients, no neumorphism — clean first.

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
    <View style={styles.flex}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={require('../../assets/logo/welgroup-logo.jpg')}
            style={styles.logo}
            resizeMode="contain"
          />

          <BlurView intensity={24} tint="light" style={styles.glassCard}>
            <Text style={[type.h2, styles.title]}>เข้าสู่ระบบ</Text>
            <Text style={[type.body2, styles.subtitle]}>เข้าสู่ระบบเพื่อเริ่มใช้งาน</Text>

            <View style={styles.fields}>
              <TextInput
                mode="outlined"
                label="ชื่อผู้ใช้"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                outlineColor="rgba(28,37,46,0.14)"
                activeOutlineColor={brand.primary.main}
                outlineStyle={styles.inputOutline}
                style={styles.input}
                left={<TextInput.Icon icon="account-outline" color={brand.grey[500]} />}
              />

              <TextInput
                mode="outlined"
                label="รหัสผ่าน"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={secure}
                autoCapitalize="none"
                autoCorrect={false}
                outlineColor="rgba(28,37,46,0.14)"
                activeOutlineColor={brand.primary.main}
                outlineStyle={styles.inputOutline}
                style={styles.input}
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
          </BlurView>

          <Text style={[type.caption, styles.footer]}>
            Multi-Tenant IoT RFID Laundry Management System
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: surface.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: alpha(brand.primary.main, 0.07),
  },
  blobTop: {
    width: 280,
    height: 280,
    top: -100,
    right: -80,
  },
  blobBottom: {
    width: 240,
    height: 240,
    bottom: -90,
    left: -70,
  },
  logo: {
    width: 160,
    height: 40,
    alignSelf: 'center',
    marginBottom: 32,
  },
  glassCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
    padding: 24,
    shadowColor: brand.grey[800],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
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
  input: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  inputOutline: {
    borderRadius: radius.sm,
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
    marginTop: 24,
  },
});
