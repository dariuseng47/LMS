import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { fetchFabricOverview } from '../../src/api/fabric.api';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { STATUS_LABEL } from '../../src/constants/fabric';
import { useHospitalWorkspace } from '../../src/hospital/HospitalWorkspaceContext';
import { alpha, brand, sage, surface } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { fontFamily, type } from '../../src/theme/typography';

// มินิ dashboard "ภาพรวมผ้า" — ดูผ้าทั้งโรงพยาบาลจากเครื่อง handheld (GET /fabric-items/overview)
//   1. การ์ดสรุป: ผ้าที่ยังใช้งาน + แถบสัดส่วนสถานะ
//   2. ตัวเลขย่อ: จำนวนประเภท/หมวดหมู่ + Max (Par) รวม
//   3. สถานะผ้า: จำนวน + % ต่อสถานะ (แตะเพื่อกรองรายการประเภทด้านล่าง)
//   4. ผ้าแต่ละประเภท: จำนวนเทียบ Max (= ผลรวม par level ทุกตู้ ตั้งในเว็บหน้าตู้เก็บผ้า) กรองหมวดหมู่/ค้นหา/เรียง

// ลำดับ = ลำดับ lifecycle ของผ้า แล้วตามด้วยสถานะ exception
const STATUS_ORDER = [
  'WASH',
  'CENTRAL_STOCK',
  'WARD_CABINET',
  'IN_USE_WARD',
  'HOLD',
  'PENDING_DECOMMISSION',
  'DECOMMISSIONED',
];

// สีต่อสถานะสำหรับแถบสัดส่วน — แยกให้ไม่ซ้ำกัน (STATUS_COLOR เดิมให้ตู้แผนก/ใช้งานที่วอร์ดสีเดียวกัน)
const STATUS_TONE = {
  WASH: brand.info.main,
  CENTRAL_STOCK: brand.primary.dark,
  WARD_CABINET: brand.success.main,
  IN_USE_WARD: brand.secondary.main,
  HOLD: brand.warning.main,
  PENDING_DECOMMISSION: brand.warning.dark,
  DECOMMISSIONED: brand.error.main,
};

const SORTS = [
  { key: 'count', label: 'จำนวนมาก→น้อย' },
  { key: 'max', label: 'ต่ำกว่า Max ก่อน' },
  { key: 'name', label: 'ชื่อ ก→ฮ' },
];

const fmt = (n) => String(Math.round(n ?? 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

function StatusBar({ counts, height = 10 }) {
  const total = STATUS_ORDER.reduce((sum, s) => sum + (counts[s] || 0), 0);
  if (total === 0) return <View style={[styles.bar, { height }]} />;
  return (
    <View style={[styles.bar, { height }]}>
      {STATUS_ORDER.filter((s) => counts[s]).map((s) => (
        <View key={s} style={{ flex: counts[s], backgroundColor: STATUS_TONE[s] }} />
      ))}
    </View>
  );
}

function Stat({ icon, label, value, note }) {
  return (
    <AppCard style={styles.stat}>
      <View style={styles.statIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={brand.primary.dark} />
      </View>
      <Text style={[type.caption, styles.muted]}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {note ? <Text style={[type.caption, styles.muted]}>{note}</Text> : null}
    </AppCard>
  );
}

const CategoryRow = memo(function CategoryRow({ category, statusFilter, expanded, onToggle }) {
  const count = statusFilter ? category.statusCounts[statusFilter] || 0 : category.active;
  const hasMax = category.maxQty !== null && category.maxQty > 0;
  const ratio = hasMax ? category.active / category.maxQty : 0;
  const below = hasMax && category.active < category.maxQty;
  const fillColor = below ? brand.error.main : brand.primary.main;

  return (
    <Pressable onPress={() => onToggle(category.id)} style={({ pressed }) => pressed && styles.pressed}>
      <AppCard style={styles.catCard}>
        <View style={styles.catHead}>
          <View style={styles.flex}>
            <Text style={[type.subtitle1, styles.catName]} numberOfLines={2}>
              {category.name}
            </Text>
            <Text style={[type.caption, styles.muted]}>{category.groupName || 'ไม่ระบุหมวดหมู่'}</Text>
          </View>
          <View style={styles.catCountWrap}>
            <Text style={styles.catCount}>{fmt(count)}</Text>
            <Text style={[type.caption, styles.muted]}>
              {statusFilter ? STATUS_LABEL[statusFilter] : hasMax ? `/ Max ${fmt(category.maxQty)}` : 'ชิ้น'}
            </Text>
          </View>
        </View>

        {hasMax ? (
          <>
            <View style={styles.track}>
              <View
                style={[styles.fill, { width: `${Math.min(100, ratio * 100)}%`, backgroundColor: fillColor }]}
              />
            </View>
            <Text style={[type.caption, below ? styles.belowText : styles.muted]}>
              {below
                ? `ต่ำกว่า Max ${fmt(category.maxQty - category.active)} ชิ้น (${pct(category.active, category.maxQty)}%)`
                : `${pct(category.active, category.maxQty)}% ของ Max${
                    category.active > category.maxQty ? ` · เกิน ${fmt(category.active - category.maxQty)} ชิ้น` : ''
                  }`}
            </Text>
          </>
        ) : (
          <>
            <StatusBar counts={category.statusCounts} height={6} />
            <Text style={[type.caption, styles.muted]}>ยังไม่ได้ตั้ง Max (Par) ให้ประเภทนี้</Text>
          </>
        )}

        {expanded ? (
          <View style={styles.breakdown}>
            {STATUS_ORDER.filter((s) => category.statusCounts[s]).map((s) => (
              <View key={s} style={styles.breakdownRow}>
                <View style={[styles.dot, { backgroundColor: STATUS_TONE[s] }]} />
                <Text style={[type.body2, styles.flex, styles.breakdownLabel]}>{STATUS_LABEL[s]}</Text>
                <Text style={[type.subtitle2, styles.breakdownValue]}>{fmt(category.statusCounts[s])}</Text>
              </View>
            ))}
            {category.total === 0 ? <Text style={[type.body2, styles.muted]}>ยังไม่มีผ้าประเภทนี้ในระบบ</Text> : null}
            <Text style={[type.caption, styles.muted]}>
              ทั้งหมด {fmt(category.total)} ชิ้น
              {hasMax ? ` · ตั้ง Par ไว้ ${fmt(category.cabinetCount)} ตู้` : ''}
            </Text>
          </View>
        ) : null}
      </AppCard>
    </Pressable>
  );
});

export default function FabricOverviewScreen() {
  const router = useRouter();
  const { activeHospital } = useHospitalWorkspace();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [groupKey, setGroupKey] = useState('all');
  const [statusFilter, setStatusFilter] = useState(null);
  const [sortKey, setSortKey] = useState('count');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    try {
      setData(await fetchFabricOverview());
      setError('');
    } catch (err) {
      setError(err?.message || 'โหลดภาพรวมผ้าไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // โหลดใหม่ทุกครั้งที่กลับเข้าหน้านี้ — ตัวเลขเปลี่ยนตามการสแกนจากหน้าอื่น
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleExpanded = useCallback((id) => setExpandedId((prev) => (prev === id ? null : id)), []);

  const groups = useMemo(() => {
    const list = [{ key: 'all', label: 'ทั้งหมด' }];
    (data?.categories || []).forEach((c) => {
      const key = c.groupId ?? 'none';
      if (!list.some((g) => g.key === key)) list.push({ key, label: c.groupName || 'ไม่ระบุหมวดหมู่' });
    });
    return list;
  }, [data]);

  const categories = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.categories || []).filter(
      (c) =>
        (groupKey === 'all' || (c.groupId ?? 'none') === groupKey) &&
        (!q || c.name.toLowerCase().includes(q)) &&
        (!statusFilter || c.statusCounts[statusFilter])
    );
    const countOf = (c) => (statusFilter ? c.statusCounts[statusFilter] || 0 : c.active);
    const maxRatio = (c) => (c.maxQty ? c.active / c.maxQty : Number.POSITIVE_INFINITY);
    return list.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'th');
      if (sortKey === 'max') return maxRatio(a) - maxRatio(b) || countOf(b) - countOf(a);
      return countOf(b) - countOf(a);
    });
  }, [data, groupKey, query, statusFilter, sortKey]);

  const totals = data?.totals;
  const statusCounts = data?.statusCounts || {};
  const belowMaxCount = (data?.categories || []).filter((c) => c.maxQty && c.active < c.maxQty).length;

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[brand.primary.main]} />
      }
    >
      <Pressable onPress={() => router.back()} style={styles.backLink} hitSlop={8}>
        <MaterialCommunityIcons name="chevron-left" size={20} color={brand.grey[700]} />
        <Text style={[type.body2, styles.backText]}>กลับ</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text style={[type.h3, styles.title]}>ภาพรวมผ้า</Text>
          <Text style={[type.caption, styles.muted]} numberOfLines={1}>
            {activeHospital?.name ? `${activeHospital.name} · ` : ''}
            {data?.generatedAt
              ? `อัปเดต ${new Date(data.generatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
              : 'กำลังโหลด...'}
          </Text>
        </View>
        <Pressable onPress={() => load(true)} style={styles.iconButton} hitSlop={8} disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator size="small" color={brand.primary.dark} />
          ) : (
            <MaterialCommunityIcons name="refresh" size={22} color={brand.primary.dark} />
          )}
        </Pressable>
      </View>

      {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

      {loading && !data ? (
        <ActivityIndicator style={styles.loader} color={brand.primary.main} size="large" />
      ) : totals ? (
        <>
          <AppCard elevated style={styles.hero}>
            <Text style={[type.subtitle2, styles.heroLabel]}>ผ้าที่ใช้งานอยู่ทั้งระบบ</Text>
            <View style={styles.heroValueRow}>
              <Text style={styles.heroValue}>{fmt(totals.active)}</Text>
              <Text style={[type.subtitle1, styles.heroUnit]}>ชิ้น</Text>
            </View>
            <StatusBar counts={statusCounts} height={12} />
            <Text style={[type.caption, styles.heroNote]}>
              ลงทะเบียนทั้งหมด {fmt(totals.all)} · แทงชำรุดแล้ว {fmt(totals.decommissioned)}
            </Text>
          </AppCard>

          <View style={styles.statRow}>
            <Stat
              icon="tag-multiple-outline"
              label="ประเภทผ้า"
              value={fmt(totals.categoryCount)}
              note={`${fmt(totals.groupCount)} หมวดหมู่`}
            />
            <Stat
              icon="arrow-collapse-up"
              label="Max (Par) รวม"
              value={totals.maxQty ? fmt(totals.maxQty) : '—'}
              note={
                totals.maxQty
                  ? belowMaxCount
                    ? `ต่ำกว่า Max ${belowMaxCount} ประเภท`
                    : `มีผ้า ${pct(totals.active, totals.maxQty)}% ของ Max`
                  : 'ยังไม่ได้ตั้ง Par'
              }
            />
          </View>

          <AppCard style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={[type.subtitle1, styles.sectionTitle]}>สถานะผ้า</Text>
              {statusFilter ? (
                <Pressable onPress={() => setStatusFilter(null)} hitSlop={8}>
                  <Text style={[type.caption, styles.link]}>ล้างตัวกรอง</Text>
                </Pressable>
              ) : (
                <Text style={[type.caption, styles.muted]}>แตะเพื่อกรองประเภท</Text>
              )}
            </View>
            {STATUS_ORDER.map((s) => {
              const n = statusCounts[s] || 0;
              const selected = statusFilter === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setStatusFilter(selected ? null : s)}
                  disabled={n === 0}
                  style={[styles.statusRow, selected && styles.statusRowActive, n === 0 && styles.dim]}
                >
                  <View style={[styles.dot, { backgroundColor: STATUS_TONE[s] }]} />
                  <View style={styles.flex}>
                    <View style={styles.statusLine}>
                      <Text style={[type.body2, styles.statusLabel]} numberOfLines={1}>
                        {STATUS_LABEL[s]}
                      </Text>
                      <Text style={[type.subtitle2, styles.statusValue]}>{fmt(n)}</Text>
                    </View>
                    <View style={styles.thinTrack}>
                      <View
                        style={[
                          styles.fill,
                          { width: `${pct(n, totals.all)}%`, backgroundColor: STATUS_TONE[s] },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={[type.caption, styles.statusPct]}>{pct(n, totals.all)}%</Text>
                </Pressable>
              );
            })}
          </AppCard>

          <View style={styles.sectionHead}>
            <Text style={[type.subtitle1, styles.sectionTitle]}>
              ผ้าแต่ละประเภท ({categories.length})
            </Text>
            {statusFilter ? (
              <View style={styles.filterTag}>
                <Text style={[type.caption, styles.filterTagText]} numberOfLines={1}>
                  {STATUS_LABEL[statusFilter]}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={brand.grey[500]} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="ค้นหาประเภทผ้า"
              placeholderTextColor={brand.grey[500]}
              style={[type.body2, styles.searchInput]}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={18} color={brand.grey[400]} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.chipRow}>
            {groups.map((g) => (
              <Pressable
                key={String(g.key)}
                onPress={() => setGroupKey(g.key)}
                style={[styles.chip, groupKey === g.key && styles.chipActive]}
              >
                <Text style={[type.caption, styles.chipText, groupKey === g.key && styles.chipTextActive]}>
                  {g.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.chipRow}>
            {SORTS.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => setSortKey(s.key)}
                style={[styles.sortChip, sortKey === s.key && styles.sortChipActive]}
              >
                <MaterialCommunityIcons
                  name="sort"
                  size={14}
                  color={sortKey === s.key ? brand.grey[800] : brand.grey[500]}
                />
                <Text style={[type.caption, sortKey === s.key ? styles.sortTextActive : styles.muted]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {categories.length === 0 ? (
            <EmptyState icon="tag-off-outline" title="ไม่พบประเภทผ้า" description="ลองเปลี่ยนหมวดหมู่หรือคำค้นหา" />
          ) : (
            <View style={styles.catList}>
              {categories.map((c) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  statusFilter={statusFilter}
                  expanded={expandedId === c.id}
                  onToggle={toggleExpanded}
                />
              ))}
            </View>
          )}
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { color: brand.grey[500] },
  pressed: { opacity: 0.75 },
  dim: { opacity: 0.45 },
  backLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2 },
  backText: { color: brand.grey[700] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: -8 },
  title: { color: brand.grey[800] },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
  },
  error: { color: brand.error.dark },
  loader: { marginTop: 40 },

  hero: { gap: 10, backgroundColor: brand.primary.darker },
  heroLabel: { color: alpha(brand.common.white, 0.8) },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  heroValue: { fontFamily: fontFamily.headingExtraBold, fontSize: 48, lineHeight: 56, color: brand.common.white },
  heroUnit: { color: alpha(brand.common.white, 0.8) },
  heroNote: { color: alpha(brand.common.white, 0.75) },

  bar: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: brand.grey[200],
    gap: 2,
  },

  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 2, padding: 16 },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sage.tint,
    marginBottom: 6,
  },
  statValue: { fontFamily: fontFamily.headingBold, fontSize: 28, lineHeight: 34, color: brand.grey[800] },

  section: { gap: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { color: brand.grey[800] },
  link: { color: brand.primary.dark, fontFamily: fontFamily.semiBold },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: radius.md,
  },
  statusRowActive: { backgroundColor: sage.tint },
  statusLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusLabel: { flex: 1, color: brand.grey[700] },
  statusValue: { color: brand.grey[800] },
  statusPct: { width: 40, textAlign: 'right', color: brand.grey[500] },
  dot: { width: 10, height: 10, borderRadius: 5 },
  thinTrack: {
    height: 4,
    marginTop: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: brand.grey[200],
  },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: brand.grey[200] },
  fill: { height: '100%', borderRadius: radius.pill },

  filterTag: {
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: sage.tint,
  },
  filterTagText: { color: sage.text },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: surface.border,
    marginTop: -6,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: brand.grey[800] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: surface.border,
  },
  chipActive: { backgroundColor: brand.primary.dark, borderColor: brand.primary.dark },
  chipText: { color: brand.grey[700] },
  chipTextActive: { color: brand.common.white, fontFamily: fontFamily.semiBold },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  sortChipActive: { backgroundColor: brand.grey[200] },
  sortTextActive: { color: brand.grey[800], fontFamily: fontFamily.semiBold },

  catList: { gap: 10 },
  catCard: { gap: 8, padding: 16 },
  catHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  catName: { color: brand.grey[800] },
  catCountWrap: { alignItems: 'flex-end' },
  catCount: { fontFamily: fontFamily.headingBold, fontSize: 26, lineHeight: 30, color: brand.grey[800] },
  belowText: { color: brand.error.dark, fontFamily: fontFamily.semiBold },
  breakdown: {
    gap: 6,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: surface.divider,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownLabel: { color: brand.grey[700] },
  breakdownValue: { color: brand.grey[800] },
});
