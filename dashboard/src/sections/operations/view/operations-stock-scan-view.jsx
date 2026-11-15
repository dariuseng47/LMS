'use client';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import { useTabs } from 'src/hooks/use-tabs';
import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { varAlpha } from 'src/theme/styles';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetStockScanRounds } from 'src/actions/stockScanRounds';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { StockScanCard } from './stock-scan-card';
import { StockScanRoundsTable } from './stock-scan-rounds-table';

// ----------------------------------------------------------------------

// แยกเป็นแท็บแบบเดียวกับหน้ารับผ้าหลังซัก — แท็บสแกนใช้บนจอทัชแบบพอดีจอ (ล็อกไม่ให้ทั้งหน้าเลื่อน)
// จึงย้ายตารางประวัติรอบการสแกน (ยาวได้เรื่อย ๆ) ไปอยู่อีกแท็บ
const TABS = [
  {
    value: 'scan',
    label: 'สแกนเข้าสต๊อค',
    icon: <Iconify icon="solar:radar-2-bold-duotone" width={22} />,
  },
  {
    value: 'history',
    label: 'ประวัติรอบการสแกน',
    icon: <Iconify icon="solar:history-bold-duotone" width={22} />,
  },
];

export function OperationsStockScanView() {
  const { user } = useAuthContext();
  const { hospitalId } = useEffectiveHospital();
  const tabs = useTabs('scan');

  const { rounds, refreshRounds } = useGetStockScanRounds(hospitalId);

  // ผ้าถูกสแกนเข้าสต๊อคจากที่ไหนก็ตาม -> รีเฟรชประวัติรอบการสแกนทันที
  useSocketEvent('scan:stock-scan', refreshRounds);

  return (
    <RoleBasedGuard
      hasContent
      currentRole={user?.role}
      acceptRoles={['SUPERADMIN', 'ADMIN', 'OPERATOR']}
    >
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="สแกนเข้าสต๊อค"
          links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'สแกนเข้าสต๊อค' }]}
          // แท็บสแกนใช้บนจอทัชแบบพอดีจอ — ลดช่องว่างด้านบนให้พื้นที่สแกนเหลือมากที่สุด
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

            {tabs.value === 'scan' && (
              <StockScanCard hospitalId={hospitalId} onConfirmed={() => refreshRounds()} />
            )}

            {tabs.value === 'history' && <StockScanRoundsTable rounds={rounds} />}
          </>
        )}
      </DashboardContent>
    </RoleBasedGuard>
  );
}
