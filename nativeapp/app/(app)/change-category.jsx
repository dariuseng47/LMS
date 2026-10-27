import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Modal, Portal, TextInput } from 'react-native-paper';

import { fetchFabricCategories } from '../../src/api/fabricCategories.api';
import { changeFabricCategory, revertFabricCategoryChange } from '../../src/api/fabric.api';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { PermissionGate } from '../../src/components/PermissionGate';
import { ScannedTagChip } from '../../src/components/ScannedTagChip';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { SelectField } from '../../src/components/SelectField';
import { TriggerScanStatus } from '../../src/components/TriggerScanStatus';
import { useTriggerScan } from '../../src/rfid/useTriggerScan';
import { brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

// เมนู "เปลี่ยนประเภทผ้า" — สแกนผ้ารายชิ้นหรือเป็นชุด เลือกประเภทปลายทาง (หมวดหมู่ → ประเภท) แล้วเปลี่ยนรวดเดียว
// ทุกครั้งที่เปลี่ยนเป็น 1 batch ฝั่ง server (เก็บค่าก่อน/หลังรายชิ้น + log) กด "ย้อนกลับ" ได้ทันทีหลังเปลี่ยน
// ดูประวัติทั้งหมดและย้อนย้อนหลังได้ที่เว็บ (จัดการผ้าและล็อต › เปลี่ยนหมวดหมู่ / ประเภทผ้า)

function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

export default function ChangeCategoryScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [groupKey, setGroupKey] = useState(null); // null = ยังไม่เลือก, 'all' = ทุกหมวด, 'none' = ยังไม่จัดหมวดหมู่
  const [categoryId, setCategoryId] = useState(null);
  const [epcCodes, setEpcCodes] = useState([]);
  const [bulkEpc, setBulkEpc] = useState('');
  const [manualVisible, setManualVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState([]); // [{ batchId, count, toName, reverted, reverting }]

  useEffect(() => {
    fetchFabricCategories()
      .then((data) => setCategories(data.categories || []))
      .catch(() => setError('โหลดรายการประเภทผ้าไม่สำเร็จ'));
  }, []);

  const groupOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'ทั้งหมด' }];
    categories.forEach((category) => {
      const key = category.group_id ?? 'none';
      if (!options.some((o) => o.value === key)) {
        options.push({ value: key, label: category.group_name || 'ไม่ระบุหมวดหมู่' });
      }
    });
    return options;
  }, [categories]);

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => groupKey === 'all' || (c.group_id ?? 'none') === groupKey)
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, groupKey]
  );

  const selectGroup = (key) => {
    setGroupKey(key);
    setPreview(null);
    if (!categories.some((c) => c.id === categoryId && (key === 'all' || (c.group_id ?? 'none') === key))) {
      setCategoryId(null);
    }
  };

  const targetName = categories.find((c) => c.id === categoryId)?.name;
  const ready = !!categoryId;

  const addEpcs = (codes) => {
    setPreview(null);
    setEpcCodes((prev) => [...new Set([...prev, ...codes])]);
  };

  const removeEpc = (code) => {
    setPreview(null);
    setEpcCodes((prev) => prev.filter((c) => c !== code));
  };

  const clearEpcs = () => {
    setPreview(null);
    setEpcCodes([]);
    setError('');
  };

  const { hasRfidDevice, rfidStatus, rfidErrorMessage, triggerActive } = useTriggerScan({
    enabled: ready,
    onEpc: (code) => addEpcs([code]),
  });

  const handleCheck = async () => {
    if (!categoryId) {
      setError('เลือกประเภทผ้าปลายทางก่อน');
      return;
    }
    if (epcCodes.length === 0) {
      setError('สแกนหรือกรอกรหัส EPC อย่างน้อย 1 รายการ');
      return;
    }
    setError('');
    setChecking(true);
    try {
      setPreview(
        await changeFabricCategory({
          epcCodes,
          toCategoryId: categoryId,
          reason: reason.trim() || undefined,
          confirm: false,
        })
      );
    } catch (err) {
      setError(err?.message || 'ตรวจสอบไม่สำเร็จ');
    } finally {
      setChecking(false);
    }
  };

  const handleApply = async () => {
    setError('');
    setApplying(true);
    try {
      const result = await changeFabricCategory({
        epcCodes,
        toCategoryId: categoryId,
        reason: reason.trim() || undefined,
        confirm: true,
      });
      setRecent((prev) =>
        [
          { batchId: result.batchId, count: result.applied.length, toName: result.toCategory.name },
          ...prev,
        ].slice(0, 5)
      );
      setEpcCodes([]);
      setPreview(null);
      setReason('');
    } catch (err) {
      setError(err?.message || 'เปลี่ยนประเภทผ้าไม่สำเร็จ');
    } finally {
      setApplying(false);
    }
  };

  const doRevert = async (entry) => {
    setRecent((prev) => prev.map((r) => (r.batchId === entry.batchId ? { ...r, reverting: true } : r)));
    try {
      const result = await revertFabricCategoryChange(entry.batchId, { confirm: true });
      setRecent((prev) =>
        prev.map((r) =>
          r.batchId === entry.batchId
            ? { ...r, reverting: false, reverted: true, revertedCount: result.reverted.length, conflicts: result.conflicts.length }
            : r
        )
      );
    } catch (err) {
      setRecent((prev) => prev.map((r) => (r.batchId === entry.batchId ? { ...r, reverting: false } : r)));
      setError(err?.message || 'ย้อนกลับไม่สำเร็จ');
    }
  };

  const confirmRevert = (entry) => {
    Alert.alert(
      'ย้อนกลับการเปลี่ยน',
      `ย้ายผ้า ${entry.count} ชิ้นกลับเป็นประเภทเดิมก่อนเปลี่ยนเป็น "${entry.toName}" ?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ย้อนกลับ', style: 'destructive', onPress: () => doRevert(entry) },
      ]
    );
  };

  const readyCount = preview?.ready?.length ?? 0;

  return (
    <PermissionGate perm="handheld.change_category.view">
      <ScreenContainer>
        <Pressable onPress={() => router.back()} style={styles.backLink} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={brand.grey[700]} />
          <Text style={[type.body2, styles.backText]}>กลับ</Text>
        </Pressable>

        <Text style={[type.h3, styles.title]}>เปลี่ยนประเภทผ้า</Text>
        <Text style={[type.body2, styles.subtitle]}>
          สแกนผ้าเป็นชุดแล้วย้ายไปประเภทใหม่ — มี log ทุกชิ้น และย้อนกลับได้
        </Text>

        <AppCard style={styles.card}>
          <Text style={[type.subtitle1, styles.sectionTitle]}>1. เลือกประเภทปลายทาง</Text>
          <SelectField
            label="หมวดหมู่ผ้า"
            placeholder="เลือกหมวดหมู่ผ้า"
            value={groupKey}
            options={groupOptions}
            onChange={selectGroup}
          />
          <SelectField
            label="ประเภทผ้าปลายทาง"
            placeholder={groupKey ? 'เลือกประเภทผ้า (พิมพ์ค้นหาได้)' : 'เลือกหมวดหมู่ผ้าก่อน'}
            value={categoryId}
            options={categoryOptions}
            onChange={(value) => {
              setCategoryId(value);
              setPreview(null);
            }}
            searchable
            disabled={!groupKey}
            emptyText="ไม่มีประเภทผ้าในหมวดหมู่นี้"
          />
        </AppCard>

        {ready ? (
          <AppCard style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={[type.subtitle1, styles.sectionTitle, styles.flex]}>
                2. สแกนผ้า ({epcCodes.length})
              </Text>
              {epcCodes.length > 0 ? (
                <Pressable onPress={clearEpcs} style={styles.clearButton} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle-outline" size={18} color={brand.primary.dark} />
                  <Text style={[type.subtitle2, styles.clearLabel]}>ล้าง</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setManualVisible(true)} style={styles.cornerButton} hitSlop={8}>
                <MaterialCommunityIcons name="keyboard-outline" size={18} color={brand.primary.dark} />
              </Pressable>
            </View>

            {hasRfidDevice ? (
              <TriggerScanStatus
                status={rfidStatus}
                errorMessage={rfidErrorMessage}
                triggerActive={triggerActive}
                idleLabel="เหนี่ยวปุ่มไกที่ตัวเครื่องเพื่อสแกนผ้า"
              />
            ) : (
              <Text style={[type.body2, styles.muted]}>
                ยังไม่ได้เลือกเครื่องอ่าน RFID — กดปุ่มคีย์บอร์ดมุมขวาเพื่อกรอกรหัส EPC เอง
              </Text>
            )}

            {epcCodes.length === 0 ? (
              <Text style={[type.body2, styles.muted]}>ยังไม่มีรายการ</Text>
            ) : (
              <View style={styles.chipRow}>
                {epcCodes.map((code) => (
                  <ScannedTagChip key={code} epc={code} onRemove={removeEpc} />
                ))}
              </View>
            )}

            <TextInput
              mode="outlined"
              label="เหตุผล (ไม่บังคับ)"
              value={reason}
              onChangeText={setReason}
              maxLength={500}
              outlineColor={brand.grey[300]}
              activeOutlineColor={brand.primary.main}
              style={styles.reasonInput}
            />

            {!preview ? (
              <AppButton
                variant="filled"
                onPress={handleCheck}
                loading={checking}
                disabled={checking || epcCodes.length === 0}
              >
                ตรวจสอบก่อนเปลี่ยน
              </AppButton>
            ) : null}
          </AppCard>
        ) : null}

        {preview ? (
          <AppCard style={styles.card}>
            <Text style={[type.subtitle1, styles.sectionTitle]}>3. ตรวจสอบและยืนยัน</Text>

            <View style={styles.targetBox}>
              <MaterialCommunityIcons name="arrow-right-bold-circle-outline" size={20} color={sage.text} />
              <Text style={[type.subtitle1, styles.targetText]} numberOfLines={2}>
                {preview.toCategory.groupName ? `${preview.toCategory.groupName} › ` : ''}
                {preview.toCategory.name}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="check-circle-outline" size={18} color={sage.text} />
              <Text style={[type.body2, styles.summaryText]}>เปลี่ยนได้ {readyCount} ชิ้น</Text>
            </View>

            {preview.ready.slice(0, 15).map((row) => (
              <View key={row.itemId} style={styles.rowLine}>
                <Text style={[type.caption, styles.rowEpc]} numberOfLines={1}>
                  {row.epcCode.slice(-8)}
                </Text>
                <Text style={[type.caption, styles.rowFrom]} numberOfLines={1}>
                  {row.fromCategoryName}
                </Text>
              </View>
            ))}
            {readyCount > 15 ? (
              <Text style={[type.caption, styles.muted]}>…และอีก {readyCount - 15} ชิ้น</Text>
            ) : null}

            {preview.same.length > 0 ? (
              <Text style={[type.body2, styles.muted]}>
                ℹ️ อยู่ประเภทนี้แล้ว {preview.same.length} ชิ้น (ข้าม)
              </Text>
            ) : null}
            {preview.blocked.length > 0 ? (
              <Text style={[type.body2, styles.errorDark]}>
                ⛔ เปลี่ยนไม่ได้ (จำหน่ายออกแล้ว) {preview.blocked.length} ชิ้น:{' '}
                {preview.blocked.map((b) => b.epcCode.slice(-8)).join(', ')}
              </Text>
            ) : null}
            {preview.notFound.length > 0 ? (
              <Text style={[type.body2, styles.errorDark]}>
                ❓ ไม่พบในระบบ {preview.notFound.length} ชิ้น: {preview.notFound.join(', ')}
              </Text>
            ) : null}

            <AppButton
              variant="filled"
              onPress={handleApply}
              loading={applying}
              disabled={applying || readyCount === 0}
            >
              ยืนยันเปลี่ยนประเภท ({readyCount} ชิ้น)
            </AppButton>
            <AppButton variant="text" onPress={() => setPreview(null)} disabled={applying}>
              แก้ไขรายการ
            </AppButton>
          </AppCard>
        ) : null}

        {error ? <Text style={[type.body2, styles.error]}>{error}</Text> : null}

        {recent.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={[type.subtitle2, styles.muted]}>รายการล่าสุด (ย้อนกลับได้)</Text>
            {recent.map((entry) => (
              <AppCard key={entry.batchId} style={styles.historyCard}>
                <Text style={[type.body2, styles.historyText]}>
                  {entry.count} ชิ้น → {entry.toName}
                </Text>
                {entry.reverted ? (
                  <Text style={[type.caption, styles.muted]}>
                    ย้อนกลับแล้ว {entry.revertedCount} ชิ้น
                    {entry.conflicts ? ` (ข้าม ${entry.conflicts} ชิ้นที่ถูกเปลี่ยนต่อแล้ว)` : ''}
                  </Text>
                ) : (
                  <AppButton
                    variant="soft"
                    icon="undo-variant"
                    onPress={() => confirmRevert(entry)}
                    loading={entry.reverting}
                    disabled={entry.reverting}
                    contentStyle={styles.smallButton}
                  >
                    ย้อนกลับ
                  </AppButton>
                )}
              </AppCard>
            ))}
            <Text style={[type.caption, styles.muted]}>
              ดูประวัติทั้งหมดและย้อนย้อนหลังได้ที่เว็บ: จัดการผ้าและล็อต › เปลี่ยนหมวดหมู่ / ประเภทผ้า
            </Text>
          </View>
        ) : null}

        <Portal>
          <Modal
            visible={manualVisible}
            onDismiss={() => setManualVisible(false)}
            contentContainerStyle={styles.modalWrap}
          >
            <View style={styles.modalCard}>
              <Text style={[type.subtitle1, styles.sectionTitle]}>วางรหัส EPC หลายรายการ</Text>
              <TextInput
                mode="outlined"
                value={bulkEpc}
                onChangeText={setBulkEpc}
                placeholder={'เช่น\nEPC-0001\nEPC-0002'}
                multiline
                numberOfLines={5}
                autoFocus
                autoCapitalize="characters"
                outlineColor={brand.grey[300]}
                activeOutlineColor={brand.primary.main}
                style={styles.modalInput}
              />
              <View style={styles.modalActions}>
                <AppButton variant="text" onPress={() => setManualVisible(false)} style={styles.flex}>
                  ยกเลิก
                </AppButton>
                <AppButton
                  variant="filled"
                  onPress={() => {
                    addEpcs(parseEpcCodes(bulkEpc));
                    setBulkEpc('');
                    setManualVisible(false);
                  }}
                  disabled={!bulkEpc.trim()}
                  style={styles.flex}
                >
                  เพิ่ม
                </AppButton>
              </View>
            </View>
          </Modal>
        </Portal>
      </ScreenContainer>
    </PermissionGate>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backText: { color: brand.grey[700] },
  title: { color: brand.grey[800], marginTop: 4 },
  subtitle: { color: brand.grey[500], marginBottom: 4 },
  card: { gap: 12 },
  sectionTitle: { color: brand.grey[800] },
  muted: { color: brand.grey[500] },
  error: { color: brand.error.main },
  errorDark: { color: brand.error.dark },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: sage.tint,
  },
  clearLabel: { color: brand.primary.dark },
  cornerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: brand.grey[100],
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonInput: { backgroundColor: '#FFFFFF' },
  targetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: sage.tint,
  },
  targetText: { color: sage.text, flexShrink: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { color: brand.grey[700] },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowEpc: { color: brand.grey[800], width: 78 },
  rowFrom: { flex: 1, color: brand.grey[500] },
  historySection: { gap: 8 },
  historyCard: { padding: 12, gap: 8 },
  historyText: { color: brand.grey[800] },
  smallButton: { minHeight: 44 },
  modalWrap: { paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: radius.card, padding: 20, gap: 16 },
  modalInput: { backgroundColor: '#FFFFFF', minHeight: 110, borderRadius: radius.sm },
  modalActions: { flexDirection: 'row', gap: 10 },
});
