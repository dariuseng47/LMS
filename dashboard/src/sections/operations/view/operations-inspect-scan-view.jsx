'use client';

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

import { InspectScanCard } from './inspect-scan-card';
import { READER_TAB, ScanReaderTab } from './scan-reader-tab';

// ----------------------------------------------------------------------

const TABS = [
  {
    value: 'scan',
    label: 'สแกนตรวจสอบผ้า',
    icon: <Iconify icon="solar:shield-check-bold-duotone" width={22} />,
  },
  READER_TAB,
];

const READER_DEVICE_TYPE = 'RFID_CHECKPOINT';
// ไม่มีเครื่องเริ่มต้นของจุดนี้ -> ใช้ของจุดสแกนเข้าสต๊อค -> เครื่องแรก (fallbackFirst)
const READER_POINTS = ['INSPECT_SCAN', 'STOCK_SCAN'];

// สแกนตรวจสอบผ้า — สแกนผ้าผ่านเครื่องอ่าน RFID จุดตรวจสอบแบบเดียวกับ "สแกนเข้าสต๊อค" แต่ทำงานแบบ
// "สแกนค้นหาผ้า" บน handheld: อ่านอย่างเดียว ไม่บันทึกอะไรลงระบบ ลิสต์ว่าเจอผ้าอะไรบ้าง (สถานะ/ตำแหน่ง/
// รอบซัก) แล้วกดแต่ละชิ้นเปิดโปรไฟล์ผ้า (ประวัติซัก รอบซัก ไทม์ไลน์) ตัวเดียวกับหน้าคลังผ้าทั้งหมด
export function OperationsInspectScanView() {
  const { user } = useAuthContext();
  const { hospitalId } = useEffectiveHospital();
  const tabs = useTabs('scan');

  const reader = useScanReader({
    hospitalId,
    deviceType: READER_DEVICE_TYPE,
    points: READER_POINTS,
    fallbackFirst: true,
  });

  return (
    <RoleBasedGuard
      hasContent
      currentRole={user?.role}
      acceptRoles={['SUPERADMIN', 'ADMIN', 'OPERATOR']}
    >
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="สแกนตรวจสอบผ้า"
          links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'สแกนตรวจสอบผ้า' }]}
          sx={{ mb: tabs.value === 'scan' ? 2 : { xs: 3, md: 4 } }}
        />

        {!hospitalId ? (
          <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
        ) : (
          <>
            <Tabs
              value={tabs.value}
              onChange={tabs.onChange}
              sx={{
                mb: tabs.value === 'scan' ? 2 : 3,
                boxShadow: (t) =>
                  `inset 0 -2px 0 0 ${varAlpha(t.vars.palette.grey['500Channel'], 0.08)}`,
              }}
            >
              {TABS.map((tab) => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  icon={tab.icon}
                  iconPosition="start"
                  label={tab.label}
                />
              ))}
            </Tabs>

            {/* ซ่อนแทนการถอดออก — สลับไปแท็บอื่น (เช่น เปลี่ยนเครื่องอ่าน) แล้วรายการที่สแกนไว้ยังอยู่
                key = โรงพยาบาล -> สลับโรงพยาบาลแล้วเริ่มรายการใหม่ทั้งหมด (หยุดอ่านต่อเนื่องด้วย) */}
            <Box sx={{ display: tabs.value === 'scan' ? 'block' : 'none' }}>
              <InspectScanCard
                key={hospitalId}
                hospitalId={hospitalId}
                reader={reader}
                active={tabs.value === 'scan'}
                onOpenReader={() => tabs.setValue(READER_TAB.value)}
              />
            </Box>

            {tabs.value === READER_TAB.value && (
              <ScanReaderTab reader={reader} deviceType={READER_DEVICE_TYPE} />
            )}
          </>
        )}
      </DashboardContent>
    </RoleBasedGuard>
  );
}
