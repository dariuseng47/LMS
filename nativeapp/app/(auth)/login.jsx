import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { useAuth } from '../../src/auth/AuthContext';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { brand, surface } from '../../src/theme/colors';
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Image
          source={require('../../assets/logo/welgroup-logo.jpg')}
          style={styles.logo}
          resizeMode="contain"
        />

        <AppCard style={styles.card} elevated>
          <Text style={[type.h3, styles.title]}>เข้าสู่ระบบ</Text>
          <Text style={[type.body2, styles.subtitle]}>
            Multi-Tenant IoT RFID Laundry Management System
          </Text>

          <TextInput
            mode="outlined"
            label="ชื่อผู้ใช้"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            outlineColor={brand.grey[300]}
            activeOutlineColor={brand.primary.main}
            style={styles.input}
          />

          <TextInput
            mode="outlined"
            label="รหัสผ่าน"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={secure}
            autoCapitalize="none"
            autoCorrect={false}
            outlineColor={brand.grey[300]}
            activeOutlineColor={brand.primary.main}
            style={styles.input}
            right={
              <TextInput.Icon
                icon={secure ? 'eye-outline' : 'eye-off-outline'}
                onPress={() => setSecure((prev) => !prev)}
                color={brand.grey[500]}
              />
            }
          />

          {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

          <AppButton
            variant="filled"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.submit}
          >
            เข้าสู่ระบบ
          </AppButton>
        </AppCard>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: surface.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },
  logo: {
    width: '70%',
    height: 70,
    alignSelf: 'center',
  },
  card: {
    gap: 14,
  },
  title: {
    color: brand.grey[800],
  },
  subtitle: {
    color: brand.grey[500],
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
  },
  error: {
    color: brand.error.main,
  },
  submit: {
    marginTop: 8,
  },
});
