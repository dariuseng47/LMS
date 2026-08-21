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
import { alpha, brand, sage, surface } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.blob, styles.blobLarge]} />
          <View style={[styles.blob, styles.blobSmall]} />
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/logo/welgroup-logo.jpg')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={styles.form}>
          <Text style={[type.h2, styles.title]}>ยินดีต้อนรับกลับ</Text>
          <Text style={[type.body2, styles.subtitle]}>เข้าสู่ระบบเพื่อเริ่มใช้งาน</Text>

          <View style={styles.fields}>
            <TextInput
              mode="outlined"
              label="ชื่อผู้ใช้"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              outlineColor={surface.border}
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
              outlineColor={surface.border}
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
            icon="arrow-right"
          >
            เข้าสู่ระบบ
          </AppButton>

          <Text style={[type.caption, styles.footer]}>
            Multi-Tenant IoT RFID Laundry Management System
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: surface.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: sage.tint,
  },
  blobLarge: {
    width: 320,
    height: 320,
    top: -140,
    right: -80,
  },
  blobSmall: {
    width: 180,
    height: 180,
    backgroundColor: alpha(brand.primary.main, 0.18),
    bottom: -60,
    left: -60,
  },
  logoBadge: {
    width: 168,
    height: 96,
    borderRadius: radius.card,
    backgroundColor: surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: brand.grey[800],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  logo: {
    width: '100%',
    height: 48,
  },
  form: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 6,
  },
  title: {
    color: brand.grey[800],
  },
  subtitle: {
    color: brand.grey[500],
    marginBottom: 20,
  },
  fields: {
    gap: 16,
  },
  input: {
    backgroundColor: surface.card,
  },
  inputOutline: {
    borderRadius: radius.md,
  },
  error: {
    color: brand.error.main,
    marginTop: 12,
  },
  submit: {
    marginTop: 24,
  },
  submitContent: {
    height: 50,
    flexDirection: 'row-reverse',
  },
  footer: {
    color: brand.grey[400],
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
});
