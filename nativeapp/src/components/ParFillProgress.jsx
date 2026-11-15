import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { alpha, brand, sage } from '../theme/colors';
import { radius } from '../theme/theme';
import { type } from '../theme/typography';

// สีของสถานะเทียบ Par — ใช้ชุดเดียวกันทั้งแอป/เว็บ: ขาด = เหลือง, ครบ = เขียว, เกิน = ฟ้า
export const PAR_STATUS_META = {
  short: { color: brand.warning.dark, bg: alpha(brand.warning.main, 0.16), bar: brand.warning.main },
  full: { color: sage.text, bg: sage.tint, bar: brand.success.main },
  over: { color: brand.info.dark, bg: alpha(brand.info.main, 0.14), bar: brand.info.main },
  noPar: { color: brand.grey[600], bg: brand.grey[200], bar: brand.grey[400] },
};

/**
 * คำนวณ "หลังเติม" ต่อชนิดผ้าของขั้นที่ 2 (หยิบผ้าจากรถเข้าตู้) เทียบกับ Par
 * @param reconciliation ผลตรวจนับขั้นที่ 1 (actualQty/parLevelQty ต่อชนิดผ้า)
 * @param savedByCategory { [categoryId]: จำนวนที่จ่ายเข้าตู้สำเร็จแล้วในรอบนี้ }
 * @param pendingCodes EPC ที่สแกนรอยืนยัน
 * @param infoByEpc { [epc]: { categoryId, categoryName } | { notFound: true } | { error: true } }
 */
export function buildParFillRows({ reconciliation, savedByCategory, pendingCodes, infoByEpc }) {
  const pendingByCategory = new Map();
  const extraNames = new Map();
  let checking = 0;
  let notFound = 0;
  for (const code of pendingCodes) {
    const info = infoByEpc[code];
    if (!info) {
      checking += 1;
    } else if (info.notFound) {
      notFound += 1;
    } else if (info.categoryId != null) {
      pendingByCategory.set(info.categoryId, (pendingByCategory.get(info.categoryId) || 0) + 1);
      extraNames.set(info.categoryId, info.categoryName);
    }
  }

  const rows = reconciliation.map((r) => {
    const filled = (savedByCategory[r.fabricCategoryId] || 0) + (pendingByCategory.get(r.fabricCategoryId) || 0);
    const after = r.actualQty + filled;
    const par = r.parLevelQty;
    let status = 'short';
    if (after > par) status = 'over';
    else if (after === par) status = 'full';
    return {
      categoryId: r.fabricCategoryId,
      categoryName: r.categoryName,
      par,
      before: r.actualQty,
      filled,
      after,
      status,
      diff: Math.abs(par - after),
    };
  });

  // ผ้าที่สแกนเข้ามาแต่ตู้นี้ไม่ได้ตั้ง Par ของชนิดนั้นไว้ — เติมได้ แต่บอกให้รู้
  const known = new Set(reconciliation.map((r) => r.fabricCategoryId));
  for (const [categoryId, count] of pendingByCategory) {
    if (known.has(categoryId)) continue; // eslint-disable-line no-continue
    rows.push({
      categoryId,
      categoryName: extraNames.get(categoryId) || 'ไม่ระบุประเภท',
      par: null,
      before: 0,
      filled: count + (savedByCategory[categoryId] || 0),
      after: count + (savedByCategory[categoryId] || 0),
      status: 'noPar',
      diff: 0,
    });
  }

  return { rows, checking, notFound, overRows: rows.filter((r) => r.status === 'over') };
}

function statusLabel(row) {
  if (row.status === 'over') return `เกิน ${row.diff}`;
  if (row.status === 'full') return 'ครบ';
  if (row.status === 'noPar') return 'ไม่มี Par';
  return `ขาดอีก ${row.diff}`;
}

// แผงเทียบ Par ของขั้นที่ 2 — แต่ละชนิดผ้า: หลังเติม / Par + แถบความคืบหน้า + ป้ายสถานะ
export function ParFillProgress({ rows, checking, notFound, skippedInCabinet }) {
  if (rows.length === 0 && checking === 0 && notFound === 0 && skippedInCabinet === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[type.subtitle2, styles.header]}>เทียบกับ Par (หลังเติม / Par)</Text>
        {checking > 0 ? <Text style={[type.caption, styles.muted]}>กำลังตรวจ {checking} ชิ้น…</Text> : null}
      </View>

      {rows.map((row) => {
        const meta = PAR_STATUS_META[row.status];
        const ratio = row.par ? Math.min(row.after / row.par, 1) : 1;
        return (
          <View key={row.categoryId} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={[type.body2, styles.name]} numberOfLines={1}>
                {row.categoryName}
              </Text>
              <Text style={[type.subtitle2, { color: meta.color }]}>
                {row.par == null ? row.after : `${row.after}/${row.par}`}
              </Text>
              <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                <Text style={[type.caption, { color: meta.color }]}>{statusLabel(row)}</Text>
              </View>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${ratio * 100}%`, backgroundColor: meta.bar }]} />
            </View>
          </View>
        );
      })}

      {notFound > 0 || skippedInCabinet > 0 ? (
        <View style={styles.notes}>
          {notFound > 0 ? (
            <Text style={[type.caption, styles.errorNote]}>ไม่พบในระบบ {notFound} ชิ้น (จะจ่ายไม่สำเร็จ)</Text>
          ) : null}
          {skippedInCabinet > 0 ? (
            <View style={styles.noteRow}>
              <MaterialCommunityIcons name="information-outline" size={14} color={brand.grey[500]} />
              <Text style={[type.caption, styles.muted]}>
                ข้ามผ้าที่อยู่ในตู้แล้ว (สแกนเจอตอนตรวจนับ) {skippedInCabinet} ชิ้น
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: brand.grey[100],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  header: {
    color: brand.grey[700],
  },
  muted: {
    color: brand.grey[500],
  },
  row: {
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    color: brand.grey[800],
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    minWidth: 52,
    alignItems: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: brand.grey[300],
    overflow: 'hidden',
  },
  bar: {
    height: 4,
    borderRadius: 2,
  },
  notes: {
    gap: 4,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorNote: {
    color: brand.error.main,
  },
});
