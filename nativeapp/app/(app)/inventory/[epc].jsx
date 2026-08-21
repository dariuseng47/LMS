import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { decommissionFabricItem, fetchFabricItemByEpc, holdFabricItem } from '../../../src/api/fabric.api';
import { useAuth } from '../../../src/auth/AuthContext';
import { AppButton } from '../../../src/components/AppButton';
import { AppCard } from '../../../src/components/AppCard';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { StatusChip } from '../../../src/components/StatusChip';
import { brand } from '../../../src/theme/colors';
import { type } from '../../../src/theme/typography';

export default function FabricDetailScreen() {
  const { epc } = useLocalSearchParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMode, setActionMode] = useState(null); // null | 'hold' | 'decommission'
  const [reasonCode, setReasonCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const canManage = user?.role === 'ADMIN' || user?.role === 'OPERATOR';

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchFabricItemByEpc(epc);
      setDetail(data);
    } catch (err) {
      setError(err?.message || 'โหลดข้อมูลผ้าไม่สำเร็จ');
    }
  }, [epc]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const submitAction = async () => {
    if (!reasonCode.trim()) {
      setActionError('กรุณาระบุเหตุผล');
      return;
    }
    setSubmitting(true);
    setActionError('');
    try {
      if (actionMode === 'hold') {
        await holdFabricItem(detail.fabricItem.id, { reasonCode: reasonCode.trim() });
      } else {
        await decommissionFabricItem(detail.fabricItem.id, { reasonCode: reasonCode.trim() });
      }
      setActionMode(null);
      setReasonCode('');
      await load();
    } catch (err) {
      setActionError(err?.message || 'ดำเนินการไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={brand.primary.main} size="large" />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <ScreenContainer>
        <Text style={[type.body1, styles.error]}>{error || 'ไม่พบข้อมูล'}</Text>
      </ScreenContainer>
    );
  }

  const { fabricItem, scanHistory } = detail;
  const isClosed = fabricItem.status === 'DECOMMISSIONED';

  return (
    <ScreenContainer>
      <AppCard style={styles.summaryCard} elevated>
        <View style={styles.summaryHeader}>
          <Text style={[type.h3, styles.epc]} numberOfLines={1}>
            {fabricItem.epc_code}
          </Text>
          <StatusChip label={fabricItem.status} color="primary" />
        </View>
        <Text style={[type.body2, styles.meta]}>ซักแล้ว {fabricItem.wash_count} รอบ</Text>
        {fabricItem.photo_url ? (
          <Text style={[type.caption, styles.meta]}>มีรูปแนบ: {fabricItem.photo_url}</Text>
        ) : null}
      </AppCard>

      {canManage && !isClosed && actionMode === null ? (
        <View style={styles.actionRow}>
          <AppButton variant="soft" onPress={() => setActionMode('hold')} style={styles.actionButton}>
            พักผ้า
          </AppButton>
          <AppButton
            variant="outlined"
            onPress={() => setActionMode('decommission')}
            style={styles.actionButton}
          >
            แทงชำรุด
          </AppButton>
        </View>
      ) : null}

      {actionMode ? (
        <AppCard style={styles.formCard}>
          <Text style={[type.subtitle2, styles.meta]}>
            {actionMode === 'hold' ? 'เหตุผลที่พักผ้า' : 'เหตุผลที่แทงชำรุด'}
          </Text>
          <TextInput
            mode="outlined"
            value={reasonCode}
            onChangeText={setReasonCode}
            placeholder="เช่น ผ้าขาด, รอยเปื้อนล้างไม่ออก"
            outlineColor={brand.grey[300]}
            activeOutlineColor={brand.primary.main}
          />
          {actionError ? <Text style={[type.caption, styles.error]}>{actionError}</Text> : null}
          <View style={styles.actionRow}>
            <AppButton
              variant="filled"
              onPress={submitAction}
              loading={submitting}
              disabled={submitting}
              style={styles.actionButton}
            >
              ยืนยัน
            </AppButton>
            <AppButton
              variant="text"
              onPress={() => {
                setActionMode(null);
                setReasonCode('');
                setActionError('');
              }}
              disabled={submitting}
              style={styles.actionButton}
            >
              ยกเลิก
            </AppButton>
          </View>
        </AppCard>
      ) : null}

      <View style={styles.historySection}>
        <Text style={[type.subtitle1, styles.meta]}>ประวัติการสแกน</Text>
        {scanHistory.length === 0 ? (
          <Text style={[type.body2, styles.meta]}>ยังไม่มีประวัติการสแกน</Text>
        ) : (
          scanHistory.map((scan) => (
            <AppCard key={scan.id} style={styles.historyCard}>
              <View style={styles.historyRow}>
                <Text style={[type.subtitle2, styles.epc]}>{scan.event_type}</Text>
                <Text style={[type.caption, styles.meta]}>
                  {new Date(scan.scanned_at).toLocaleString('th-TH')}
                </Text>
              </View>
            </AppCard>
          ))
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: brand.error.main,
  },
  summaryCard: {
    gap: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  epc: {
    color: brand.grey[800],
    flexShrink: 1,
  },
  meta: {
    color: brand.grey[500],
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  formCard: {
    gap: 10,
  },
  historySection: {
    gap: 8,
  },
  historyCard: {
    padding: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
