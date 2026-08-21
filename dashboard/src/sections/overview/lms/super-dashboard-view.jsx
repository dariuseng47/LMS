'use client';

import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useGetHospitalsSummary } from 'src/actions/hospitals';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

function HospitalSummaryCard({ hospital }) {
  return (
    <CardActionArea
      component={RouterLink}
      href={paths.dashboard.hq.hospitalDetails(hospital.id)}
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: (theme) => `1px solid ${theme.vars.palette.divider}`,
        transition: (theme) => theme.transitions.create(['box-shadow', 'border-color']),
        '&:hover': { boxShadow: (theme) => theme.customShadows?.z8 ?? 4, borderColor: 'primary.main' },
      }}
    >
      <Stack spacing={2} sx={{ width: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Stack
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 1.5,
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'primary.lighter',
              color: 'primary.dark',
            }}
          >
            <Iconify icon="solar:hospital-bold-duotone" width={22} />
          </Stack>
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {hospital.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
              {hospital.organizationName}
            </Typography>
          </Stack>
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip
            size="small"
            variant="soft"
            icon={<Iconify icon="solar:t-shirt-bold-duotone" width={14} />}
            label={`ผ้า ${hospital.fabricCount}`}
          />
          <Chip
            size="small"
            variant="soft"
            icon={<Iconify icon="solar:users-group-rounded-bold-duotone" width={14} />}
            label={`ผู้ใช้ ${hospital.userCount}`}
          />
          <Chip
            size="small"
            variant="soft"
            color="success"
            icon={<Iconify icon="solar:wi-fi-router-bold-duotone" width={14} />}
            label={`ออนไลน์ ${hospital.devicesOnline}`}
          />
          {hospital.devicesOffline > 0 && (
            <Chip
              size="small"
              variant="soft"
              color="error"
              icon={<Iconify icon="solar:wi-fi-router-minimalistic-broken" width={14} />}
              label={`ออฟไลน์ ${hospital.devicesOffline}`}
            />
          )}
        </Stack>
      </Stack>
    </CardActionArea>
  );
}

export function SuperDashboardView() {
  const { hospitalsSummary, totals, hospitalsSummaryLoading } = useGetHospitalsSummary();

  return (
    <Stack spacing={4}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Typography variant="h4">ภาพรวมเครือข่ายโรงพยาบาล</Typography>
        <Button
          component={RouterLink}
          href={paths.dashboard.hq.hospitals}
          variant="outlined"
          startIcon={<Iconify icon="solar:buildings-3-bold-duotone" />}
        >
          จัดการโรงพยาบาล
        </Button>
      </Stack>

      {hospitalsSummaryLoading ? (
        <LoadingScreen />
      ) : hospitalsSummary.length === 0 ? (
        <EmptyContent
          title="ยังไม่มีโรงพยาบาลในระบบ"
          description="เริ่มต้นด้วยการเพิ่มโรงพยาบาลแรกที่หน้า จัดการโรงพยาบาล"
          sx={{ py: 10 }}
        />
      ) : (
        <>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:buildings-3-bold-duotone"
                title="โรงพยาบาลทั้งหมด"
                value={totals?.hospitalCount ?? 0}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:t-shirt-bold-duotone"
                title="ผ้าในระบบทั้งหมด"
                value={totals?.fabricCount ?? 0}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:wi-fi-router-bold-duotone"
                title="อุปกรณ์ออนไลน์รวม"
                value={totals?.devicesOnline ?? 0}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:users-group-rounded-bold-duotone"
                title="ผู้ใช้งานทั้งหมด"
                value={totals?.userCount ?? 0}
                color="warning"
              />
            </Grid>
          </Grid>

          <Stack spacing={2}>
            <Typography variant="subtitle1">แยกตามโรงพยาบาล — คลิกเพื่อดูรายละเอียด</Typography>
            <Grid container spacing={2.5}>
              {hospitalsSummary.map((hospital) => (
                <Grid item xs={12} sm={6} md={4} key={hospital.id}>
                  <HospitalSummaryCard hospital={hospital} />
                </Grid>
              ))}
            </Grid>
          </Stack>
        </>
      )}
    </Stack>
  );
}
