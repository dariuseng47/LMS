'use client';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';

import { useTabs } from 'src/hooks/use-tabs';
import { useScanReader } from 'src/hooks/use-scan-reader';
import { usePermission } from 'src/hooks/use-has-permission';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { varAlpha } from 'src/theme/styles';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetFabricLots, useGetFabricCategories } from 'src/actions/fabric';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { READER_TAB, ScanReaderTab } from 'src/sections/operations/view/scan-reader-tab';

import { ChangeHistoryCard } from './change-history-card';
import { RevertChangeDialog } from './revert-change-dialog';
import { ChangeCategoryCard } from './change-category-card';

// ----------------------------------------------------------------------

const TABS = [
  {
    value: 'change',
    label: 'เปลี่ยนประเภทผ้า',
    icon: <Iconify icon="solar:transfer-horizontal-bold-duotone" width={22} />,
  },
  {
    value: 'history',
    label: 'ประวัติ & ย้อนกลับ',
    icon: <Iconify icon="solar:history-bold-duotone" width={22} />,
  },
];

// เลือกสแกนได้ทั้งเครื่องอ่าน RFID ที่จุดตรวจสอบ และประตูชั่งน้ำหนัก
const READER_DEVICE_TYPES = ['RFID_CHECKPOINT', 'WEIGHT_GATE'];
// ตัวแรก = ชื่อจุดของหน้านี้ ใช้เป็นคีย์จำเครื่องที่เลือก (แยกจากหน้าสแกนอื่น)
// ตัวถัดไป = ยืมเครื่องเริ่มต้นของจุดสแกนเดิม จุดตรวจสอบก่อน แล้วค่อยประตูชั่งน้ำหนัก
const READER_POINTS = ['CHANGE_CATEGORY', 'STOCK_SCAN', 'INSPECT_SCAN', 'WASH_RECEIVE'];

export function FabricChangeCategoryView() {
  const { hospitalId } = useEffectiveHospital();
  const { can, ready: permissionsReady } = usePermission();
  const canEdit = can('web.fabric.change_category.edit');
  // มีสิทธิ์แก้ไขหน้านี้ = สั่งเครื่องอ่าน RFID ได้ (ดู RFID_SCAN_PERMISSIONS ใน rfidReader.controller.js)
  const canUseReader = canEdit;

  const { categories, refreshCategories } = useGetFabricCategories(hospitalId);
  const { lots } = useGetFabricLots(hospitalId);
  const reader = useScanReader({
    hospitalId: canUseReader ? hospitalId : null,
    deviceTypes: READER_DEVICE_TYPES,
    points: READER_POINTS,
  });
  const visibleTabs = canUseReader ? [...TABS, READER_TAB] : TABS;

  const tabs = useTabs('change');
  // เพิ่มทุกครั้งที่มีการเปลี่ยน/ย้อน — ให้แท็บประวัติโหลดข้อมูลใหม่
  const [historyKey, setHistoryKey] = useState(0);
  const [revertBatchId, setRevertBatchId] = useState(null);
  // ผลการเปลี่ยนล่าสุด (แถบ "ย้อนกลับ / ดูประวัติ") — ผูกกับโรงพยาบาล สลับโรงพยาบาลแล้วไม่โชว์
  const [lastResult, setLastResult] = useState(null);

  const handleChanged = useCallback(() => {
    setHistoryKey((key) => key + 1);
    refreshCategories();
  }, [refreshCategories]);

  const handleApplied = useCallback(
    (result) => {
      setLastResult({ ...result, hospitalId });
      handleChanged();
    },
    [hospitalId, handleChanged]
  );

  // ย้อนรายการล่าสุดไปแล้ว (จากแถบนี้หรือแท็บประวัติ) -> เก็บแถบ ไม่ให้กดย้อนซ้ำ
  const handleReverted = useCallback(
    (result) => {
      setLastResult((prev) => (prev?.batchId === result?.revertsBatchId ? null : prev));
      handleChanged();
    },
    [handleChanged]
  );

  const isChangeTab = tabs.value === 'change';

  const renderChangeTab = () => {
    if (!permissionsReady) return <LoadingScreen sx={{ height: 320 }} />;

    if (!canEdit) {
      return (
        <Card sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          บัญชีนี้ดูประวัติได้อย่างเดียว — ต้องได้รับสิทธิ์ &quot;แก้ไข: เปลี่ยนหมวดหมู่ /
          ประเภทผ้า&quot; จึงจะเปลี่ยนประเภทผ้าได้
        </Card>
      );
    }

    // key = โรงพยาบาล -> สลับโรงพยาบาลแล้วเริ่มรายการใหม่ทั้งหมด (หยุดอ่านต่อเนื่องด้วย)
    return (
      <ChangeCategoryCard
        key={hospitalId}
        hospitalId={hospitalId}
        categories={categories}
        lots={lots}
        reader={reader}
        canUseReader={canUseReader}
        active={isChangeTab}
        lastResult={lastResult?.hospitalId === hospitalId ? lastResult : null}
        onOpenReader={() => tabs.setValue(READER_TAB.value)}
        onApplied={handleApplied}
        onDismissResult={() => setLastResult(null)}
        onViewHistory={() => tabs.setValue('history')}
        onRevertRequest={setRevertBatchId}
      />
    );
  };

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="เปลี่ยนหมวดหมู่ / ประเภทผ้า"
        links={[{ name: 'จัดการผ้าและล็อต' }, { name: 'เปลี่ยนหมวดหมู่ / ประเภทผ้า' }]}
        // แท็บสแกนใช้บนจอทัชแบบพอดีจอ — ลดช่องว่างด้านบนให้พื้นที่สแกนเหลือมากที่สุด
        sx={{ mb: isChangeTab ? 2 : { xs: 3, md: 4 } }}
      />

      {!hospitalId ? (
        <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
      ) : (
        <>
          <Tabs
            value={tabs.value}
            onChange={tabs.onChange}
            sx={{
              mb: isChangeTab ? 2 : 3,
              boxShadow: (theme) =>
                `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
            }}
          >
            {visibleTabs.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                icon={tab.icon}
                iconPosition="start"
                label={tab.label}
              />
            ))}
          </Tabs>

          {/* ซ่อนแทนการถอดออก — สลับไปแท็บอื่น (เช่น เปลี่ยนเครื่องอ่าน) แล้วรายการที่สแกนไว้ยังอยู่ */}
          <Box sx={{ display: isChangeTab ? 'block' : 'none' }}>{renderChangeTab()}</Box>

          {tabs.value === 'history' && (
            <ChangeHistoryCard
              hospitalId={hospitalId}
              canEdit={canEdit}
              refreshKey={historyKey}
              onReverted={handleReverted}
            />
          )}

          {tabs.value === READER_TAB.value && canUseReader && (
            <ScanReaderTab reader={reader} deviceTypes={READER_DEVICE_TYPES} />
          )}
        </>
      )}

      <RevertChangeDialog
        open={!!revertBatchId}
        batchId={revertBatchId}
        hospitalId={hospitalId}
        onClose={() => setRevertBatchId(null)}
        onReverted={handleReverted}
      />
    </DashboardContent>
  );
}
