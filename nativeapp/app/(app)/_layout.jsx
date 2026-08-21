import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthContext';
import { tabs } from '../../src/constants/nav';
import { brand, sage, surface } from '../../src/theme/colors';
import { shadow } from '../../src/theme/shadows';
import { radius } from '../../src/theme/theme';
import { fontFamily } from '../../src/theme/typography';

export default function AppLayout() {
  const { status } = useAuth();
  const insets = useSafeAreaInsets();

  if (status === 'booting') {
    return null;
  }

  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.primary.dark,
        tabBarInactiveTintColor: brand.grey[400],
        // Floating pill bar instead of the old full-width bordered bar — modern trend,
        // and it reads as one deliberate object instead of a strip glued to the edge.
        tabBarStyle: [
          styles.tabBar,
          { bottom: Math.max(insets.bottom, 12) },
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: { fontFamily: fontFamily.semiBold, fontSize: 11 },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            // Label only shows for the active tab — keeps the bar calm with 5 items,
            // the icon pill alone is enough affordance for the inactive ones.
            tabBarLabel: ({ focused, color }) =>
              focused ? (
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                  {tab.label}
                </Text>
              ) : null,
            tabBarIcon: ({ color, focused, size }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <MaterialCommunityIcons
                  name={focused ? tab.iconActive : tab.icon}
                  color={color}
                  size={size - 2}
                />
              </View>
            ),
          }}
        />
      ))}
      <Tabs.Screen name="account" options={{ href: null, title: 'บัญชีผู้ใช้' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: surface.card,
    borderTopWidth: 0,
    paddingHorizontal: 4,
    ...shadow.raised,
  },
  tabBarItem: {
    paddingTop: 8,
  },
  iconWrap: {
    width: 40,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: sage.tint,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    marginTop: 2,
  },
});
