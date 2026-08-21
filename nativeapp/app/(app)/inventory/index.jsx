import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { fetchFabricItems } from '../../../src/api/fabric.api';
import { AppCard } from '../../../src/components/AppCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { ScannerInput } from '../../../src/components/ScannerInput';
import { StatusChip } from '../../../src/components/StatusChip';
import { STATUS_COLOR, STATUS_LABEL } from '../../../src/constants/fabric';
import { brand, surface } from '../../../src/theme/colors';
import { type } from '../../../src/theme/typography';

export default function InventoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (epcCode) => {
    setError('');
    try {
      const data = await fetchFabricItems(epcCode ? { epcCode } : undefined);
      setItems(data.fabricItems || []);
    } catch (err) {
      setError(err?.message || 'โหลดรายการผ้าไม่สำเร็จ');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(search.trim() || undefined);
    setRefreshing(false);
  };

  const handleSearchSubmit = async () => {
    setLoading(true);
    await load(search.trim() || undefined);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/inventory/register')}
              style={styles.headerButton}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={22} color={brand.primary.dark} />
            </Pressable>
          ),
        }}
      />

      <View style={styles.searchBar}>
        <ScannerInput
          value={search}
          onChangeText={setSearch}
          onSubmit={handleSearchSubmit}
          placeholder="ค้นหาด้วยรหัส EPC"
        />
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
              icon="archive-search-outline"
              title="ไม่พบผ้าในระบบ"
              description={search ? 'ลองค้นหาด้วยรหัส EPC อื่น' : 'ยังไม่มีข้อมูลผ้าในคลัง'}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/inventory/${item.epc_code}`)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <AppCard style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={[type.subtitle1, styles.epc]} numberOfLines={1}>
                    {item.epc_code}
                  </Text>
                  <Text style={[type.caption, styles.meta]}>ซักแล้ว {item.wash_count} รอบ</Text>
                </View>
                <StatusChip
                  label={STATUS_LABEL[item.status] ?? item.status}
                  color={STATUS_COLOR[item.status] || 'default'}
                />
              </View>
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
  headerButton: {
    marginRight: 12,
    padding: 4,
  },
  searchBar: {
    padding: 16,
    paddingBottom: 8,
  },
  error: {
    color: brand.error.main,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    // Clearance for the floating tab bar — see ScreenContainer.jsx.
    paddingBottom: 110,
    gap: 10,
  },
  itemCard: {
    padding: 14,
  },
  pressed: {
    opacity: 0.7,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  epc: {
    color: brand.grey[800],
  },
  meta: {
    color: brand.grey[500],
  },
});
