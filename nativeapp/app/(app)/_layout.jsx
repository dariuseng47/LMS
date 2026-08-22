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
        tabBarLabelStyle: { fontFamily: fontFamily.semiBold, fontSize: 13 },
      }}
    >
      {tabs.map((tab) => {
        // "หน้าแรก" อยู่กึ่งกลางแถบเมนู (ดู src/constants/nav.js) และตั้งใจให้เป็นปุ่มวงกลม
        // ใหญ่เด่นลอยขึ้นมาเหนือแถบ ต่างจากแท็บอื่นที่เป็นไอคอนแบบ pill ปกติ
        const isHome = tab.name === 'home';

        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              tabBarItemStyle: isHome ? styles.tabBarItemHome : styles.tabBarItem,
              // Label only shows for the active tab (calmer bar) — ยกเว้น home ที่ไม่โชว์เลย
              // เพราะวงกลมใหญ่เห็นชัดเจนอยู่แล้วในตัวเอง
              tabBarLabel: ({ focused, color }) =>
                !isHome && focused ? (
                  <Text style={[styles.label, { color }]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                ) : null,
              tabBarIcon: ({ color, focused, size }) =>
                isHome ? (
                  <View style={styles.homeCircle}>
                    <MaterialCommunityIcons
                      name={focused ? tab.iconActive : tab.icon}
                      color={brand.primary.contrastText}
                      size={size + 10}
                    />
                  </View>
                ) : (
                  <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                    <MaterialCommunityIcons
                      name={focused ? tab.iconActive : tab.icon}
                      color={color}
                      size={size + 4}
                    />
                  </View>
                ),
            }}
          />
        );
      })}
      <Tabs.Screen name="account" options={{ href: null, title: 'บัญชีผู้ใช้' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: 'ตั้งค่าเครื่อง' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: surface.card,
    borderTopWidth: 0,
    paddingHorizontal: 4,
    ...shadow.raised,
  },
  tabBarItem: {
    paddingTop: 10,
  },
  tabBarItemHome: {
    paddingTop: 0,
  },
  iconWrap: {
    width: 48,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: sage.tint,
  },
  // วงกลมใหญ่ลอยขึ้นเหนือแถบเมนู — จุดเด่นตรงกลาง แตะง่ายเพราะเป็นปุ่มที่ใช้บ่อยที่สุด
  homeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.primary.main,
    borderWidth: 4,
    borderColor: surface.card,
    ...shadow.raised,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    marginTop: 2,
  },
});
