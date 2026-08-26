'use client';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useSocketEvent } from 'src/hooks/use-socket-event';

import { varAlpha, bgGradient } from 'src/theme/styles';
import { useGetHospitalsSummary } from 'src/actions/hospitals';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

function HospitalSummaryCard({ hospital }) {
  const hasIssue = hospital.devicesOffline > 0;

  return (
    <CardActionArea
      component={RouterLink}
      href={paths.dashboard.hq.hospitalDetails(hospital.id)}
      sx={{
        p: 2.5,
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden',
        border: (theme) => `1px solid ${theme.vars.palette.divider}`,
        transition: (theme) => theme.transitions.create(['box-shadow', 'border-color', 'transform']),
        '&:hover': {
          boxShadow: (theme) => theme.customShadows?.z8 ?? 4,
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          bgcolor: hasIssue ? 'error.main' : 'success.main',
        },
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
  const theme = useTheme();

  const { hospitalsSummary, totals, hospitalsSummaryLoading, refreshHospitalsSummary } =
    useGetHospitalsSummary();

  // superadmin socket join ห้องของทุกโรงพยาบาลไว้แล้วตอน connect (ดู server/src/sockets/index.js)
  // -> เหตุการณ์จากโรงพยาบาลไหนก็ตามอัปเดตภาพรวมนี้ได้ทันที
  useSocketEvent('scan:created', refreshHospitalsSummary);
  useSocketEvent('scan:ward-issue', refreshHospitalsSummary);
  useSocketEvent('scan:ward-receive', refreshHospitalsSummary);
  useSocketEvent('fabric:hold', refreshHospitalsSummary);
  useSocketEvent('fabric:decommission', refreshHospitalsSummary);
  useSocketEvent('device:status_changed', refreshHospitalsSummary);

  return (
    <Stack spacing={4}>
      <Box
        sx={{
          ...bgGradient({
            color: `to right, ${theme.vars.palette.grey[900]} 0%, ${varAlpha(
              theme.vars.palette.primary.darkerChannel,
              0.92
            )} 100%`,
          }),
          p: { xs: 3, md: 4 },
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden',
          color: 'common.white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Iconify
          icon="solar:buildings-3-bold-duotone"
          width={200}
          sx={{
            position: 'absolute',
            right: -20,
            bottom: -60,
            opacity: 0.12,
            color: 'common.white',
            display: { xs: 'none', sm: 'block' },
          }}
        />

        <Stack spacing={0.5} sx={{ position: 'relative' }}>
          <Typography variant="h4">ภาพรวมเครือข่ายโรงพยาบาล</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            ติดตามผ้าและอุปกรณ์ของทุกโรงพยาบาลในเครือข่ายจากที่เดียว
          </Typography>
        </Stack>

        <Button
          component={RouterLink}
          href={paths.dashboard.hq.hospitals}
          variant="contained"
          color="primary"
          startIcon={<Iconify icon="solar:buildings-3-bold-duotone" />}
          sx={{ position: 'relative' }}
        >
          จัดการโรงพยาบาล
        </Button>
      </Box>

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
