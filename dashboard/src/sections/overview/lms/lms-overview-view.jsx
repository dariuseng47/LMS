'use client';

import { useMemo, useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetHospitals, useDashboardSummary } from 'src/actions/hospitals';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const STATUS_LABEL = {
  WASH: 'ซัก',
  DRY: 'อบ',
  WEIGHT_COUNT: 'ชั่งน้ำหนัก/นับ',
  FOLDING_QC: 'พับ/QC',
  CENTRAL_STOCK: 'สต๊อกกลาง',
  WARD_CABINET: 'ตู้แผนก',
  IN_USE_WARD: 'ใช้งานที่วอร์ด',
  HOLD: 'พักใช้งาน',
  DECOMMISSIONED: 'แทงชำรุด',
};

function StatCard({ icon, title, value, color = 'primary' }) {
  return (
    <Card>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Stack
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => theme.vars.palette[color].lighter,
            color: (theme) => theme.vars.palette[color].dark,
          }}
        >
          <Iconify icon={icon} width={24} />
        </Stack>
        <Stack>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {title}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function LmsOverviewView() {
  const { user } = useAuthContext();
  const isSuperadmin = user?.role === 'SUPERADMIN';

  const { hospitals } = useGetHospitals();
  const [selectedHospitalId, setSelectedHospitalId] = useState('');

  useEffect(() => {
    if (isSuperadmin && !selectedHospitalId && hospitals.length > 0) {
      setSelectedHospitalId(hospitals[0].id);
    }
  }, [isSuperadmin, hospitals, selectedHospitalId]);

  const hospitalId = isSuperadmin ? selectedHospitalId : user?.hospital_id;

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
          <TextField
            select
            size="small"
            label="โรงพยาบาล"
            value={selectedHospitalId}
            onChange={(event) => setSelectedHospitalId(event.target.value)}
            sx={{ minWidth: 240 }}
          >
            {hospitals.map((hospital) => (
              <MenuItem key={hospital.id} value={hospital.id}>
                {hospital.name}
              </MenuItem>
            ))}
          </TextField>
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
