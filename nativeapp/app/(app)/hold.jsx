import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { fetchFabricItems } from '../../src/api/fabric.api';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { brand, sage, surface } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

const filters = [
  { key: 'HOLD', label: 'พักใช้งาน' },
  { key: 'DECOMMISSIONED', label: 'แทงชำรุด' },
];

export default function HoldScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('HOLD');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchFabricItems({ status });
      setItems(data.fabricItems || []);
    } catch (err) {
      setError(err?.message || 'โหลดรายการไม่สำเร็จ');
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.segment}>
        {filters.map((item) => {
          const active = status === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setStatus(item.key)}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
            >
              <Text style={[type.subtitle2, styles.segmentLabel, active && styles.segmentLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="pause-circle-outline"
              title={status === 'HOLD' ? 'ไม่มีผ้าที่พักใช้งาน' : 'ไม่มีผ้าที่แทงชำรุด'}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/inventory/${item.epc_code}`)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <AppCard style={styles.itemCard}>
              <Text style={[type.subtitle1, styles.epc]} numberOfLines={1}>
                {item.epc_code}
              </Text>
              <Text style={[type.caption, styles.meta]}>ซักแล้ว {item.wash_count} รอบ</Text>
            </AppCard>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: surface.background,
  },
  segment: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    backgroundColor: brand.grey[100],
    borderRadius: radius.sm,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm - 2,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentLabel: {
    color: brand.grey[500],
  },
  segmentLabelActive: {
    color: sage.text,
  },
  error: {
    color: brand.error.main,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    gap: 10,
  },
  itemCard: {
    padding: 14,
    gap: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  epc: {
    color: brand.grey[800],
  },
  meta: {
    color: brand.grey[500],
  },
});
