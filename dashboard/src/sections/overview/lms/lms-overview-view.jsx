'use client';

import { useMemo } from 'react';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { useDashboardSummary } from 'src/actions/hospitals';

import { StatCard } from 'src/components/stat-card';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { HospitalSelector } from 'src/components/hospital-selector';

import { useAuthContext } from 'src/auth/hooks';

import { SuperDashboardView } from './super-dashboard-view';
import { STATUS_LABEL } from '../../fabric/fabric-constants';

// ----------------------------------------------------------------------

// admin/operator: ภาพรวมของโรงพยาบาลตัวเอง (พฤติกรรมเดิม ไม่เปลี่ยนแปลง)
function HospitalOperationalOverview() {
  const { hospitalId, isSuperadmin, hospitals, selectedHospitalId, setSelectedHospitalId } =
    useEffectiveHospital();

  const { summary, summaryLoading } = useDashboardSummary(hospitalId);

  const totalFabric = useMemo(
    () => summary?.fabricByStatus?.reduce((sum, row) => sum + Number(row.count), 0) ?? 0,
    [summary]
  );
  const onlineDevices = useMemo(
    () => summary?.devicesByStatus?.find((row) => row.status === 'ONLINE')?.count ?? 0,
    [summary]
  );
  const offlineDevices = useMemo(
    () => summary?.devicesByStatus?.find((row) => row.status === 'OFFLINE')?.count ?? 0,
    [summary]
  );

  return (
    <DashboardContent maxWidth="xl">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: { xs: 3, md: 5 } }}
      >
        <Typography variant="h4">ภาพรวมการทำงาน</Typography>

        {isSuperadmin && (
          <HospitalSelector
            hospitals={hospitals}
            value={selectedHospitalId}
            onChange={setSelectedHospitalId}
            sx={{ minWidth: 240 }}
          />
        )}
      </Stack>

      {!hospitalId ? (
        <EmptyContent
          title={isSuperadmin ? 'ยังไม่มีโรงพยาบาลในระบบ' : 'ไม่พบข้อมูลโรงพยาบาลของบัญชีนี้'}
          sx={{ py: 10 }}
        />
      ) : summaryLoading ? (
        <LoadingScreen />
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:t-shirt-bold-duotone"
                title="ผ้าในระบบทั้งหมด"
                value={totalFabric}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:wi-fi-router-bold-duotone"
                title="อุปกรณ์ออนไลน์"
                value={onlineDevices}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:wi-fi-router-minimalistic-broken"
                title="อุปกรณ์ออฟไลน์"
                value={offlineDevices}
                color="error"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:danger-triangle-bold-duotone"
                title="ผ้าข้ามขั้นตอน (7 วันล่าสุด)"
                value={summary?.stepSkippedLast7Days ?? 0}
                color="warning"
              />
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                ผ้าแยกตามสถานะ
              </Typography>

              {summary?.fabricByStatus?.length ? (
                <Stack direction="row" flexWrap="wrap" gap={1.5}>
                  {summary.fabricByStatus.map((row) => (
                    <Chip
                      key={row.status}
                      label={`${STATUS_LABEL[row.status] ?? row.status}: ${row.count}`}
                      variant="soft"
                    />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  ยังไม่มีข้อมูลผ้าในระบบ (รอฟีเจอร์ Fabric & Lot Management)
                </Typography>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </DashboardContent>
  );
}

export function LmsOverviewView() {
  const { user } = useAuthContext();

  // superadmin เห็นภาพรวมข้ามทุกโรงพยาบาลก่อนเสมอ (ไม่บังคับเลือก รพ. เดียวเหมือน admin/operator)
  if (user?.role === 'SUPERADMIN') {
    return (
      <DashboardContent maxWidth="xl">
        <SuperDashboardView />
      </DashboardContent>
    );
  }

  return <HospitalOperationalOverview />;
}
