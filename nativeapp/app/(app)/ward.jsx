import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Menu, TextInput } from 'react-native-paper';

import { fetchCabinets } from '../../src/api/cabinets.api';
import { cabinetAuditScan, wardIssueScan, wardReceiveScan } from '../../src/api/operations.api';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { ScannerInput } from '../../src/components/ScannerInput';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { StatusChip } from '../../src/components/StatusChip';
import { STATUS_COLOR, STATUS_LABEL } from '../../src/constants/fabric';
import { getSelectedDeviceId, NONE_DEVICE_ID } from '../../src/rfid/deviceSettings';
import { useOrcaReader } from '../../src/rfid/useOrcaReader';
import { alpha, brand, sage } from '../../src/theme/colors';
import { radius } from '../../src/theme/theme';
import { type } from '../../src/theme/typography';

const modes = [
  { key: 'issue', label: 'จ่ายผ้าไปวอร์ด' },
  { key: 'receive', label: 'รับผ้าคืน' },
];

const RFID_STATUS_LABEL = {
  connecting: 'กำลังเชื่อมต่อเครื่องอ่าน...',
  connected: 'เครื่องอ่านพร้อมใช้งาน',
  error: 'เชื่อมต่อเครื่องอ่านไม่สำเร็จ',
};

function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

// จ่ายผ้าไปวอร์ดแบ่งเป็น 2 ขั้นตามที่ผู้ใช้กำหนด: (1) สแกนหน้าตู้ตรวจนับของคงเหลือจริง เทียบกับ
// par level ที่ตั้งไว้ (POST /scans/cabinet-audit) — เจอผ้าที่ระบบไม่ได้บันทึกว่าอยู่ตู้นี้ก็เตือน + ปุ่ม
// โอนเข้าแผนกนี้ (2) หยิบผ้าจากรถมาจัดเข้าจริง สแกนทีละชิ้น (ward-issue เดิม) — ล็อกขั้น 2 ไว้จนกว่าจะ
// ตรวจนับตู้เสร็จก่อน สลับตู้ปลายทางใหม่ต้องตรวจนับใหม่เสมอ
export default function WardScreen() {
  const [mode, setMode] = useState('issue');
  const [cabinets, setCabinets] = useState([]);
  const [cabinetId, setCabinetId] = useState(null);
  const [cabinetMenuVisible, setCabinetMenuVisible] = useState(false);

  const [rfidDeviceId, setRfidDeviceId] = useState(NONE_DEVICE_ID);
  const hasRfidDevice = rfidDeviceId !== NONE_DEVICE_ID;
  const {
    status: rfidStatus,
    errorMessage: rfidErrorMessage,
    singleRead,
    startBulkRead,
    stopBulkRead,
  } = useOrcaReader({ enabled: hasRfidDevice && mode === 'issue' });

  const [auditInputMode, setAuditInputMode] = useState('single'); // 'single' | 'bulk'
  const [auditEpcCodes, setAuditEpcCodes] = useState([]);
  const [auditSingleEpc, setAuditSingleEpc] = useState('');
  const [auditBulkEpc, setAuditBulkEpc] = useState('');
  const [singleScanning, setSingleScanning] = useState(false);
  const [bulkScanning, setBulkScanning] = useState(false);
  const [auditSubmitting, setAuditSubmitting] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditResult, setAuditResult] = useState(null);
  const [transferringEpc, setTransferringEpc] = useState(null);

  const [epc, setEpc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message }
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    fetchCabinets()
      .then((data) => setCabinets(data.cabinets || []))
      .catch(() => {});
    getSelectedDeviceId().then(setRfidDeviceId);
  }, []);

  const reset = () => {
    setEpc('');
    setFeedback(null);
  };

  const resetAudit = () => {
    if (bulkScanning) {
      stopBulkRead();
      setBulkScanning(false);
    }
    setAuditEpcCodes([]);
    setAuditSingleEpc('');
    setAuditBulkEpc('');
    setAuditError('');
    setAuditResult(null);
  };

  const handleSelectCabinet = (id) => {
    setCabinetId(id);
    setCabinetMenuVisible(false);
    resetAudit();
    reset();
  };

  const addAuditEpcIfNew = (code) => {
    setAuditEpcCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
  };

  const addAuditSingleEpc = () => {
    const [code] = parseEpcCodes(auditSingleEpc);
    if (!code) return;
    addAuditEpcIfNew(code);
    setAuditSingleEpc('');
  };

  const addAuditBulkEpcs = () => {
    const codes = parseEpcCodes(auditBulkEpc);
    if (codes.length === 0) return;
    setAuditEpcCodes((prev) => [...new Set([...prev, ...codes])]);
    setAuditBulkEpc('');
  };

  const removeAuditEpc = (code) => {
    setAuditEpcCodes((prev) => prev.filter((c) => c !== code));
  };

  const handleRfidSingleScan = async () => {
    setAuditError('');
    setSingleScanning(true);
    try {
      const code = await singleRead();
      addAuditEpcIfNew(code);
    } catch (err) {
      setAuditError(err?.message || 'สแกนไม่สำเร็จ');
    } finally {
      setSingleScanning(false);
    }
  };

  const handleStartBulkScan = () => {
    setAuditError('');
    setBulkScanning(true);
    startBulkRead(addAuditEpcIfNew);
  };

  const handleStopBulkScan = () => {
    stopBulkRead();
    setBulkScanning(false);
  };

  const handleAuditSubmit = async () => {
    if (!cabinetId) {
      setAuditError('กรุณาเลือกตู้ปลายทางก่อน');
      return;
    }
    if (auditEpcCodes.length === 0) {
      setAuditError('กรุณาสแกนหรือกรอกรหัส EPC ที่เจอในตู้อย่างน้อย 1 รายการ');
      return;
    }
    if (bulkScanning) handleStopBulkScan();

    setAuditSubmitting(true);
    setAuditError('');
    try {
      const result = await cabinetAuditScan({ cabinetId, epcCodes: auditEpcCodes });
      setAuditResult(result);
      setAuditEpcCodes([]);
    } catch (err) {
      setAuditError(err?.message || 'ตรวจนับไม่สำเร็จ');
    } finally {
      setAuditSubmitting(false);
    }
  };

  const handleTransferAnomaly = async (item) => {
    setTransferringEpc(item.epcCode);
    try {
      await wardIssueScan({ epcCode: item.epcCode, cabinetId });
      setAuditResult((prev) =>
        prev ? { ...prev, anomalies: prev.anomalies.filter((a) => a.epcCode !== item.epcCode) } : prev
      );
    } catch (err) {
      setAuditError(err?.message || 'โอนผ้าเข้าแผนกนี้ไม่สำเร็จ');
    } finally {
      setTransferringEpc(null);
    }
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

  const restockLocked = mode === 'issue' && !auditResult;

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
        <>
          <AppCard style={styles.cabinetCard}>
            <Text style={[type.subtitle2, styles.sectionLabel]}>เลือกตู้ปลายทาง</Text>
            {cabinets.length === 0 ? (
              <Text style={[type.body2, styles.sectionLabel]}>ไม่พบตู้เก็บผ้าในระบบ</Text>
            ) : (
              <Menu
                visible={cabinetMenuVisible}
                onDismiss={() => setCabinetMenuVisible(false)}
                anchor={
                  <Pressable
                    onPress={() => setCabinetMenuVisible(true)}
                    style={styles.dropdown}
                  >
                    <Text
                      style={[
                        type.body1,
                        styles.dropdownText,
                        !cabinetId && styles.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {cabinets.find((c) => c.id === cabinetId)?.name || 'เลือกตู้ปลายทาง'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={22} color={brand.grey[500]} />
                  </Pressable>
                }
                anchorPosition="bottom"
                contentStyle={styles.dropdownMenu}
              >
                {cabinets.map((cabinet) => (
                  <Menu.Item
                    key={cabinet.id}
                    onPress={() => handleSelectCabinet(cabinet.id)}
                    title={cabinet.name}
                    titleStyle={type.body1}
                  />
                ))}
              </Menu>
            )}
          </AppCard>

          {cabinetId ? (
            <AppCard style={styles.auditCard}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepBadge}>
                  <Text style={[type.subtitle2, styles.stepBadgeText]}>1</Text>
                </View>
                <Text style={[type.subtitle1, styles.stepTitle]}>ตรวจนับตู้ผ้า</Text>
              </View>
              <Text style={[type.body2, styles.stepHint]}>
                สแกนผ้าทุกชิ้นที่เจอในตู้นี้ตอนนี้ ก่อนหยิบผ้าจากรถมาจัดเข้า
              </Text>

              <View style={styles.segmentSmall}>
                {[
                  { key: 'single', label: 'เพิ่มทีละชิ้น' },
                  { key: 'bulk', label: 'วางหลายรายการ' },
                ].map((item) => {
                  const active = auditInputMode === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setAuditInputMode(item.key)}
                      style={[styles.segmentItem, active && styles.segmentItemActive]}
                    >
                      <Text
                        style={[type.caption, styles.segmentLabel, active && styles.segmentLabelActive]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {hasRfidDevice ? (
                <StatusChip
                  label={
                    rfidStatus === 'error' ? rfidErrorMessage || RFID_STATUS_LABEL.error : RFID_STATUS_LABEL[rfidStatus]
                  }
                  color={rfidStatus === 'connected' ? 'success' : rfidStatus === 'error' ? 'error' : 'info'}
                />
              ) : null}

              {auditInputMode === 'single' ? (
                <View style={styles.addRow}>
                  {hasRfidDevice ? (
                    <AppButton
                      variant="filled"
                      icon="wifi"
                      onPress={handleRfidSingleScan}
                      loading={singleScanning}
                      disabled={singleScanning || rfidStatus !== 'connected'}
                    >
                      แตะเพื่อสแกน 1 แท็ก
                    </AppButton>
                  ) : null}
                  <TextInput
                    mode="outlined"
                    value={auditSingleEpc}
                    onChangeText={setAuditSingleEpc}
                    onSubmitEditing={addAuditSingleEpc}
                    placeholder="หรือพิมพ์รหัส EPC เอง"
                    autoCapitalize="characters"
                    outlineColor={brand.grey[300]}
                    activeOutlineColor={brand.primary.main}
                    style={styles.addInput}
                  />
                  <AppButton variant="soft" onPress={addAuditSingleEpc} style={styles.addButton}>
                    เพิ่ม
                  </AppButton>
                </View>
              ) : (
                <View style={styles.addRow}>
                  {hasRfidDevice ? (
                    <AppButton
                      variant="filled"
                      icon={bulkScanning ? 'stop' : 'wifi'}
                      onPress={bulkScanning ? handleStopBulkScan : handleStartBulkScan}
                      disabled={!bulkScanning && rfidStatus !== 'connected'}
                    >
                      {bulkScanning ? 'หยุดสแกน' : 'เริ่มสแกนต่อเนื่อง'}
                    </AppButton>
                  ) : null}
                  <TextInput
                    mode="outlined"
                    value={auditBulkEpc}
                    onChangeText={setAuditBulkEpc}
                    placeholder={'หรือวางได้หลายรายการเอง เช่น\nEPC-0001\nEPC-0002'}
                    multiline
                    numberOfLines={4}
                    autoCapitalize="characters"
                    outlineColor={brand.grey[300]}
                    activeOutlineColor={brand.primary.main}
                    style={styles.bulkInput}
                  />
                  <AppButton variant="soft" onPress={addAuditBulkEpcs} style={styles.addButton}>
                    เพิ่มทั้งหมด
                  </AppButton>
                </View>
              )}

              <Text style={[type.subtitle2, styles.sectionLabel]}>
                รายการที่สแกนแล้ว ({auditEpcCodes.length})
              </Text>
              {auditEpcCodes.length === 0 ? (
                <Text style={[type.body2, styles.sectionLabel]}>ยังไม่มีรายการ</Text>
              ) : (
                <View style={styles.chipRow}>
                  {auditEpcCodes.map((code) => (
                    <View key={code} style={styles.epcChip}>
                      <Text style={[type.caption, styles.epcChipLabel]}>{code}</Text>
                      <Pressable onPress={() => removeAuditEpc(code)} hitSlop={6}>
                        <MaterialCommunityIcons name="close" size={14} color={sage.text} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {auditError ? <Text style={[type.body2, styles.error]}>{auditError}</Text> : null}

              <AppButton
                variant="filled"
                onPress={handleAuditSubmit}
                loading={auditSubmitting}
                disabled={auditSubmitting}
              >
                ยืนยันตรวจนับ
              </AppButton>
            </AppCard>
          ) : null}

          {auditResult ? (
            <AppCard style={styles.resultCard}>
              <Text style={[type.subtitle1, styles.stepTitle]}>ผลตรวจนับ</Text>

              {auditResult.unknownEpcs?.length > 0 ? (
                <Text style={[type.body2, styles.error]}>
                  ไม่พบในระบบ: {auditResult.unknownEpcs.join(', ')}
                </Text>
              ) : null}

              {auditResult.reconciliation.length > 0 ? (
                <View style={styles.reconList}>
                  {auditResult.reconciliation.map((row) => (
                    <View key={row.fabricCategoryId} style={styles.reconRow}>
                      <Text style={[type.body1, styles.reconCategory]} numberOfLines={1}>
                        {row.categoryName}
                      </Text>
                      <Text style={[type.subtitle1, styles.reconQty, row.lowStock && styles.reconQtyLow]}>
                        {row.actualQty}/{row.parLevelQty}
                      </Text>
                      {row.lowStock ? (
                        <View style={styles.lowStockBadge}>
                          <MaterialCommunityIcons name="alert-outline" size={13} color={brand.warning.dark} />
                          <Text style={[type.caption, styles.lowStockText]}>ขาด {row.shortageQty}</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[type.body2, styles.sectionLabel]}>ยังไม่ได้ตั้งค่า par level ให้ตู้นี้</Text>
              )}

              {auditResult.anomalies?.length > 0 ? (
                <View style={styles.anomalySection}>
                  <View style={styles.anomalyHeaderRow}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color={brand.error.dark} />
                    <Text style={[type.subtitle2, styles.anomalyHeaderText]}>
                      พบผ้าที่ไม่ได้บันทึกว่าอยู่ตู้นี้ ({auditResult.anomalies.length})
                    </Text>
                  </View>
                  {auditResult.anomalies.map((item) => (
                    <View key={item.epcCode} style={styles.anomalyRow}>
                      <View style={styles.anomalyInfo}>
                        <Text style={[type.body2, styles.anomalyEpc]} numberOfLines={1}>
                          {item.epcCode}
                        </Text>
                        <View style={styles.anomalyMetaRow}>
                          <StatusChip
                            label={STATUS_LABEL[item.status] ?? item.status}
                            color={STATUS_COLOR[item.status] || 'default'}
                          />
                          {item.categoryName ? (
                            <Text style={[type.caption, styles.anomalyMeta]} numberOfLines={1}>
                              {item.categoryName}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <AppButton
                        variant="soft"
                        onPress={() => handleTransferAnomaly(item)}
                        loading={transferringEpc === item.epcCode}
                        disabled={transferringEpc === item.epcCode}
                        contentStyle={styles.transferButtonContent}
                        labelStyle={styles.transferButtonLabel}
                        style={styles.transferButton}
                      >
                        โอนผ้าเข้าแผนกนี้
                      </AppButton>
                    </View>
                  ))}
                </View>
              ) : null}
            </AppCard>
          ) : null}
        </>
      ) : null}

      {mode === 'receive' || cabinetId ? (
        <AppCard style={[styles.scanCard, restockLocked && styles.scanCardLocked]}>
          {mode === 'issue' ? (
            <View style={styles.stepHeaderRow}>
              <View style={[styles.stepBadge, restockLocked && styles.stepBadgeLocked]}>
                <Text style={[type.subtitle2, styles.stepBadgeText]}>2</Text>
              </View>
              <Text style={[type.subtitle1, styles.stepTitle]}>หยิบผ้าจากรถมาจัดเข้าตู้</Text>
            </View>
          ) : (
            <Text style={[type.subtitle2, styles.sectionLabel]}>รหัส EPC</Text>
          )}

          {restockLocked ? (
            <Text style={[type.body2, styles.stepHint]}>ตรวจนับตู้ผ้าให้เสร็จก่อน (ขั้นที่ 1)</Text>
          ) : null}

          <ScannerInput
            value={epc}
            onChangeText={setEpc}
            onSubmit={handleSubmit}
            disabled={restockLocked}
          />

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

          <AppButton
            variant="filled"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || restockLocked}
          >
            {mode === 'issue' ? 'ยืนยันจ่ายผ้า' : 'ยืนยันรับผ้าคืน'}
          </AppButton>
        </AppCard>
      ) : null}

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
  segmentSmall: {
    flexDirection: 'row',
    backgroundColor: brand.grey[100],
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
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
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 58,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: '#FFFFFF',
  },
  dropdownText: {
    flex: 1,
    color: brand.grey[800],
  },
  dropdownPlaceholder: {
    color: brand.grey[400],
  },
  dropdownMenu: {
    marginTop: 4,
  },
  auditCard: {
    gap: 12,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.primary.main,
  },
  stepBadgeLocked: {
    backgroundColor: brand.grey[400],
  },
  stepBadgeText: {
    color: '#FFFFFF',
  },
  stepTitle: {
    color: brand.grey[800],
    flex: 1,
  },
  stepHint: {
    color: brand.grey[500],
  },
  addRow: {
    gap: 10,
  },
  addInput: {
    backgroundColor: '#FFFFFF',
  },
  bulkInput: {
    backgroundColor: '#FFFFFF',
    minHeight: 100,
  },
  addButton: {
    alignSelf: 'flex-start',
    minWidth: 100,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  epcChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: alpha(brand.primary.main, 0.12),
  },
  epcChipLabel: {
    color: sage.text,
  },
  error: {
    color: brand.error.main,
  },
  resultCard: {
    gap: 12,
  },
  reconList: {
    gap: 8,
  },
  reconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: brand.grey[100],
  },
  reconCategory: {
    flex: 1,
    color: brand.grey[800],
  },
  reconQty: {
    color: brand.grey[700],
  },
  reconQtyLow: {
    color: brand.warning.dark,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: alpha(brand.warning.main, 0.16),
  },
  lowStockText: {
    color: brand.warning.dark,
  },
  anomalySection: {
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: brand.grey[200],
  },
  anomalyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  anomalyHeaderText: {
    color: brand.error.dark,
    flex: 1,
  },
  anomalyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: alpha(brand.error.main, 0.06),
  },
  anomalyInfo: {
    flex: 1,
    gap: 4,
  },
  anomalyEpc: {
    color: brand.grey[800],
  },
  anomalyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  anomalyMeta: {
    color: brand.grey[500],
    flexShrink: 1,
  },
  transferButton: {
    alignSelf: 'center',
  },
  transferButtonContent: {
    minHeight: 40,
    paddingHorizontal: 4,
  },
  transferButtonLabel: {
    fontSize: 13,
  },
  scanCard: {
    gap: 12,
  },
  scanCardLocked: {
    opacity: 0.5,
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
