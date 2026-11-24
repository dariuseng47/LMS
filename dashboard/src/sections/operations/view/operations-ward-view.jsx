'use client';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import { useTabs } from 'src/hooks/use-tabs';
import { useScanReader } from 'src/hooks/use-scan-reader';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { varAlpha } from 'src/theme/styles';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { WardScanCard } from './ward-scan-card';
import { WardCartPlanView } from './ward-cart-plan-view';
import { READER_TAB, ScanReaderTab } from './scan-reader-tab';
import { WardIssueHistoryView } from './ward-issue-history-view';

// ----------------------------------------------------------------------

const VIEW_TABS = [
  {
    value: 'cart',
    label: 'จัดผ้าเข้ารถ',
    icon: <Iconify icon="solar:cart-large-4-bold-duotone" width={22} />,
  },
  {
    value: 'scan',
    label: 'สแกนรับ-ส่งผ้า',
    icon: <Iconify icon="solar:scanner-bold-duotone" width={22} />,
  },
  {
    value: 'history',
    label: 'ประวัติการจ่ายผ้า',
    icon: <Iconify icon="solar:history-bold-duotone" width={22} />,
  },
  READER_TAB,
];

const READER_DEVICE_TYPE = 'RFID_CHECKPOINT';
// ตัวแรก = คีย์จำเครื่องที่เลือกของหน้านี้ (ไม่ใช่จุดที่ตั้งเครื่องเริ่มต้นได้) — ยืมเครื่องเริ่มต้นของจุดสแกนเข้าสต๊อค /
// สแกนตรวจสอบผ้า ไม่มีเลยใช้เครื่องแรก
const READER_POINTS = ['WARD_SCAN', 'STOCK_SCAN', 'INSPECT_SCAN'];

export function OperationsWardView() {
  const { user } = useAuthContext();
  const { hospitalId } = useEffectiveHospital();
  const view = useTabs('cart');

  const reader = useScanReader({
    hospitalId,
    deviceType: READER_DEVICE_TYPE,
    points: READER_POINTS,
    fallbackFirst: true,
  });

  // ปุ่ม "สแกนจ่ายผ้าเข้าตู้นี้" ในแท็บจัดผ้าเข้ารถ -> ไปแท็บสแกน เลือกตู้ + เปิดโหมดอ้างอิงแผนให้เลย
  // ผูกกับโรงพยาบาล — สลับโรงพยาบาลแล้วไม่ส่งตู้ของโรงพยาบาลเก่าไปให้การ์ดใหม่
  const [scanRequest, setScanRequest] = useState(null);
  const handleStartScan = useCallback(
    (cabinetId) => {
      setScanRequest({ cabinetId, hospitalId, at: Date.now() });
      view.setValue('scan');
    },
    [hospitalId, view]
  );

  const isScanTab = view.value === 'scan';

  return (
    <RoleBasedGuard
      hasContent
      currentRole={user?.role}
      acceptRoles={['SUPERADMIN', 'ADMIN', 'OPERATOR']}
    >
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="รับ-ส่งผ้าประจำวอร์ด"
          links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'รับ-ส่งผ้าประจำวอร์ด' }]}
          // แท็บสแกนใช้บนจอทัชแบบพอดีจอ — ลดช่องว่างด้านบนให้พื้นที่สแกนเหลือมากที่สุด
          sx={{ mb: isScanTab ? 2 : { xs: 3, md: 4 } }}
        />

        {!hospitalId ? (
          <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
        ) : (
          <>
            <Tabs
              value={view.value}
              onChange={view.onChange}
              sx={{
                mb: isScanTab ? 2 : 3,
                boxShadow: (theme) =>
                  `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
              }}
            >
              {VIEW_TABS.map((tab) => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  icon={tab.icon}
                  iconPosition="start"
                  label={tab.label}
                />
              ))}
            </Tabs>

            {view.value === 'cart' && (
              <WardCartPlanView hospitalId={hospitalId} onStartScan={handleStartScan} />
            )}

            {/* ซ่อนแทนการถอดออก — สลับไปแท็บอื่น (เช่น ดูแผน / เปลี่ยนเครื่องอ่าน) แล้วรายการที่สแกนไว้ยังอยู่
                key = โรงพยาบาล -> สลับโรงพยาบาลแล้วเริ่มรายการใหม่ทั้งหมด (หยุดอ่านต่อเนื่องด้วย) */}
            <Box sx={{ display: isScanTab ? 'block' : 'none' }}>
              <WardScanCard
                key={hospitalId}
                hospitalId={hospitalId}
                reader={reader}
                active={isScanTab}
                request={scanRequest?.hospitalId === hospitalId ? scanRequest : null}
                onOpenReader={() => view.setValue(READER_TAB.value)}
              />
            </Box>

            {view.value === 'history' && <WardIssueHistoryView hospitalId={hospitalId} />}

            {view.value === READER_TAB.value && (
              <ScanReaderTab reader={reader} deviceType={READER_DEVICE_TYPE} />
            )}
          </>
        )}
      </DashboardContent>
    </RoleBasedGuard>
  );
}
