import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '../../src/auth/AuthContext';
import { tabs } from '../../src/constants/nav';
import { brand, surface } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

export default function AppLayout() {
  const { status } = useAuth();

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
        tabBarInactiveTintColor: brand.grey[500],
        tabBarStyle: {
          backgroundColor: surface.card,
          borderTopColor: surface.border,
          borderTopWidth: 1,
          height: 60,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.semiBold, fontSize: 11 },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name={tab.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
      <Tabs.Screen name="account" options={{ href: null, title: 'บัญชีผู้ใช้' }} />
    </Tabs>
  );
}
