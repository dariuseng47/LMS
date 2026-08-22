import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthContext';
import { AppCard } from '../../src/components/AppCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { alpha, brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

const quickActions = [
  { href: '/inventory', label: 'คลังผ้าทั้งหมด', icon: 'archive-outline' },
  { href: '/ward', label: 'รับ-ส่งผ้าวอร์ด', icon: 'truck-delivery-outline' },
  { href: '/hold', label: 'พัก & ชำรุด', icon: 'pause-circle-outline' },
  { href: '/location', label: 'ค้นหาตำแหน่งผ้า', icon: 'map-marker-radius-outline' },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[type.body2, styles.greetingLabel]}>สวัสดี</Text>
          <Text style={[type.h3, styles.greetingName]} numberOfLines={1}>
            {user?.full_name || user?.username}
          </Text>
          {user?.hospital_name ? (
            <View style={styles.hospitalBadge}>
              <MaterialCommunityIcons name="hospital-building" size={14} color={sage.text} />
              <Text style={[type.caption, styles.hospitalBadgeText]}>{user.hospital_name}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={() => router.push('/account')}
          style={styles.accountButton}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="account-circle-outline" size={30} color={brand.primary.dark} />
        </Pressable>
      </View>

      <View style={styles.list}>
        {quickActions.map((action) => (
          <Pressable
            key={action.href}
            onPress={() => router.push(action.href)}
            style={({ pressed }) => [pressed && styles.listItemPressed]}
          >
            <AppCard style={styles.actionCard}>
              <View style={styles.actionIcon}>
                <MaterialCommunityIcons name={action.icon} size={30} color={brand.primary.dark} />
              </View>
              <Text style={[type.subtitle1, styles.actionLabel]} numberOfLines={1}>
                {action.label}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={26} color={brand.grey[400]} />
            </AppCard>
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  greetingLabel: {
    color: brand.grey[500],
  },
  greetingName: {
    color: brand.grey[800],
  },
  hospitalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: sage.tint,
  },
  hospitalBadgeText: {
    color: sage.text,
  },
  accountButton: {
    padding: 4,
  },
  list: {
    gap: 12,
  },
  listItemPressed: {
    opacity: 0.7,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 84,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(brand.primary.main, 0.12),
  },
  actionLabel: {
    flex: 1,
    color: brand.grey[800],
  },
});
