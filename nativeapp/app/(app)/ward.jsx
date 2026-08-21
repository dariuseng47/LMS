import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchCabinets } from '../../src/api/cabinets.api';
import { wardIssueScan, wardReceiveScan } from '../../src/api/operations.api';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { ScannerInput } from '../../src/components/ScannerInput';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { alpha, brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

const modes = [
  { key: 'issue', label: 'จ่ายผ้าไปวอร์ด' },
  { key: 'receive', label: 'รับผ้าคืน' },
];

export default function WardScreen() {
  const [mode, setMode] = useState('issue');
  const [cabinets, setCabinets] = useState([]);
  const [cabinetId, setCabinetId] = useState(null);
  const [epc, setEpc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message }
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    fetchCabinets()
      .then((data) => setCabinets(data.cabinets || []))
      .catch(() => {});
  }, []);

  const reset = () => {
    setEpc('');
    setFeedback(null);
  };

  const handleSubmit = async () => {
    if (!epc.trim()) {
      setFeedback({ type: 'error', message: 'กรุณากรอกรหัส EPC' });
      return;
    }
    if (mode === 'issue' && !cabinetId) {
      setFeedback({ type: 'error', message: 'กรุณาเลือกตู้ปลายทาง' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const result =
        mode === 'issue'
          ? await wardIssueScan({ epcCode: epc.trim(), cabinetId })
          : await wardReceiveScan({ epcCode: epc.trim() });

      setFeedback({
        type: 'success',
        message: `${result.epcCode} → ${result.status}`,
      });
      setRecent((prev) => [{ ...result, mode, at: Date.now() }, ...prev].slice(0, 10));
      setEpc('');
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'ดำเนินการไม่สำเร็จ' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.segment}>
        {modes.map((item) => {
          const active = mode === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                setMode(item.key);
                reset();
              }}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
            >
              <Text
                style={[type.subtitle2, styles.segmentLabel, active && styles.segmentLabelActive]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'issue' ? (
        <AppCard style={styles.cabinetCard}>
          <Text style={[type.subtitle2, styles.sectionLabel]}>เลือกตู้ปลายทาง</Text>
          {cabinets.length === 0 ? (
            <Text style={[type.body2, styles.sectionLabel]}>ไม่พบตู้เก็บผ้าในระบบ</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.cabinetRow}>
                {cabinets.map((cabinet) => {
                  const active = cabinetId === cabinet.id;
                  return (
                    <Pressable
                      key={cabinet.id}
                      onPress={() => setCabinetId(cabinet.id)}
                      style={[styles.cabinetChip, active && styles.cabinetChipActive]}
                    >
                      <Text
                        style={[type.body2, styles.cabinetChipLabel, active && styles.cabinetChipLabelActive]}
                      >
                        {cabinet.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </AppCard>
      ) : null}

      <AppCard style={styles.scanCard}>
        <Text style={[type.subtitle2, styles.sectionLabel]}>รหัส EPC</Text>
        <ScannerInput value={epc} onChangeText={setEpc} onSubmit={handleSubmit} />

        {feedback ? (
          <View
            style={[
              styles.feedback,
              { backgroundColor: feedback.type === 'success' ? sage.tint : alpha(brand.error.main, 0.12) },
            ]}
          >
            <MaterialCommunityIcons
              name={feedback.type === 'success' ? 'check-circle-outline' : 'alert-circle-outline'}
              size={18}
              color={feedback.type === 'success' ? sage.text : brand.error.dark}
            />
            <Text
              style={[
                type.body2,
                styles.feedbackText,
                { color: feedback.type === 'success' ? sage.text : brand.error.dark },
              ]}
            >
              {feedback.message}
            </Text>
          </View>
        ) : null}

        <AppButton variant="filled" onPress={handleSubmit} loading={submitting} disabled={submitting}>
          {mode === 'issue' ? 'ยืนยันจ่ายผ้า' : 'ยืนยันรับผ้าคืน'}
        </AppButton>
      </AppCard>

      {recent.length > 0 ? (
        <View style={styles.historySection}>
          <Text style={[type.subtitle2, styles.sectionLabel]}>รายการล่าสุด</Text>
          {recent.map((entry) => (
            <AppCard key={`${entry.epcCode}-${entry.at}`} style={styles.historyCard}>
              <Text style={[type.body2, styles.historyEpc]}>{entry.epcCode}</Text>
              <Text style={[type.caption, styles.sectionLabel]}>
                {entry.mode === 'issue' ? 'จ่ายไปวอร์ด' : 'รับคืน'} → {entry.status}
              </Text>
            </AppCard>
          ))}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
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
    color: brand.primary.dark,
  },
  cabinetCard: {
    gap: 10,
  },
  sectionLabel: {
    color: brand.grey[600],
  },
  cabinetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cabinetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.grey[300],
  },
  cabinetChipActive: {
    backgroundColor: sage.tint,
    borderColor: brand.primary.main,
  },
  cabinetChipLabel: {
    color: brand.grey[700],
  },
  cabinetChipLabelActive: {
    color: sage.text,
  },
  scanCard: {
    gap: 12,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
  },
  feedbackText: {
    flex: 1,
  },
  historySection: {
    gap: 8,
  },
  historyCard: {
    padding: 12,
    gap: 2,
  },
  historyEpc: {
    color: brand.grey[800],
  },
});
