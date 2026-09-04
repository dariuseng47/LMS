import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchFabricItemByEpc } from '../api/fabric.api';
import { alpha, brand, sage } from '../theme/colors';
import { radius } from '../theme/theme';
import { type } from '../theme/typography';

function shortEpc(epc) {
  return epc.length > 6 ? epc.slice(-6) : epc;
}

// แสดง EPC แค่ 6 ตัวท้ายทันทีที่สแกนติด (เร็ว ไม่ต้องรอ query) ส่วนชนิดผ้า lazy-load ตามมาทีหลัง
// จาก GET /fabric-items/:epc ทีละแท็ก กันไม่ให้การสแกนรัว ๆ สะดุดรอ query ก่อนขึ้นชิป
export function ScannedTagChip({ epc, onRemove }) {
  const [categoryName, setCategoryName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetchFabricItemByEpc(epc)
      .then((data) => {
        if (cancelled) return;
        setCategoryName(data?.fabricItem?.category_name ?? null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [epc]);

  return (
    <View style={styles.chip}>
      <Text style={[type.caption, styles.label]}>
        {shortEpc(epc)}
        {loading ? '' : `-${failed ? '?' : categoryName || '?'}`}
      </Text>
      {loading ? <ActivityIndicator size="small" color={sage.text} /> : null}
      {onRemove ? (
        <Pressable onPress={() => onRemove(epc)} hitSlop={6}>
          <MaterialCommunityIcons name="close" size={14} color={sage.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: alpha(brand.primary.main, 0.12),
  },
  label: {
    color: sage.text,
  },
});
