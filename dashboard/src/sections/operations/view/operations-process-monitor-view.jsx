'use client';

import { useMemo } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import TableContainer from '@mui/material/TableContainer';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { fDateTime } from 'src/utils/format-time';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetProcessStatus } from 'src/actions/tracking';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { STATUS_LABEL, STATUS_COLOR } from '../../fabric/fabric-constants';

// ----------------------------------------------------------------------

// ลำดับตามการไหลของกระบวนการจริง (weight-gate -> dry -> folding -> stock -> ward)
const PIPELINE_STATUSES = [
  'WASH',
  'DRY',
  'WEIGHT_COUNT',
  'FOLDING_QC',
  'CENTRAL_STOCK',
  'WARD_CABINET',
  'IN_USE_WARD',
];
const EXCEPTION_STATUSES = ['HOLD', 'DECOMMISSIONED'];

// StatCard อ่าน theme.vars.palette[color].lighter ตรงๆ — ไม่รองรับ 'default' แบบที่ Chip รองรับ
// (STATUS_COLOR ใช้ 'default' กับ WEIGHT_COUNT/FOLDING_QC สำหรับ Chip ที่อื่น) จึง map เป็น 'secondary' เฉพาะที่นี่
const STATCARD_COLOR_FALLBACK = { default: 'secondary' };

const STATUS_ICON = {
  WASH: 'solar:washing-machine-bold-duotone',
  DRY: 'solar:sun-bold-duotone',
  WEIGHT_COUNT: 'solar:scale-bold-duotone',
  FOLDING_QC: 'solar:layers-bold-duotone',
  CENTRAL_STOCK: 'solar:box-bold-duotone',
  WARD_CABINET: 'solar:archive-bold-duotone',
  IN_USE_WARD: 'solar:hospital-bold-duotone',
  HOLD: 'solar:pause-circle-bold-duotone',
  DECOMMISSIONED: 'solar:trash-bin-trash-bold-duotone',
};

export function OperationsProcessMonitorView() {
  const { hospitalId } = useEffectiveHospital();

  const { statusCounts, stuckItems, processStatusLoading } = useGetProcessStatus(hospitalId);

  const countByStatus = useMemo(
    () => new Map(statusCounts.map((row) => [row.status, Number(row.count)])),
    [statusCounts]
  );

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="ติดตามสถานะกระบวนการ"
        links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'ติดตามสถานะกระบวนการ' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {!hospitalId ? (
        <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
      ) : processStatusLoading ? (
        <LoadingScreen />
      ) : (
        <Stack spacing={3}>
          <div>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              ขั้นตอนหลัก
            </Typography>
            <Grid container spacing={2}>
              {PIPELINE_STATUSES.map((status) => (
                <Grid item xs={6} sm={4} md={3} key={status}>
                  <StatCard
                    icon={STATUS_ICON[status]}
                    title={STATUS_LABEL[status]}
                    value={countByStatus.get(status) ?? 0}
                    color={STATCARD_COLOR_FALLBACK[STATUS_COLOR[status]] ?? STATUS_COLOR[status]}
                  />
                </Grid>
              ))}
            </Grid>
          </div>

          <div>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              สถานะข้อยกเว้น
            </Typography>
            <Grid container spacing={2}>
              {EXCEPTION_STATUSES.map((status) => (
                <Grid item xs={6} sm={4} md={3} key={status}>
                  <StatCard
                    icon={STATUS_ICON[status]}
                    title={STATUS_LABEL[status]}
                    value={countByStatus.get(status) ?? 0}
                    color={STATCARD_COLOR_FALLBACK[STATUS_COLOR[status]] ?? STATUS_COLOR[status]}
                  />
                </Grid>
              ))}
            </Grid>
          </div>

          <Card>
            <CardHeader
              title="ผ้าที่ค้างสถานะเกินเวลาที่ตั้งไว้"
              subheader='ดูตั้งค่าได้ที่ "ความปลอดภัย & ตั้งค่าระบบ > ตั้งค่าเวลาค้างสถานะ"'
            />
            {stuckItems.length === 0 ? (
              <EmptyContent title="ไม่มีผ้าค้างสถานะเกินเวลา" sx={{ py: 8 }} />
            ) : (
              <Scrollbar>
                <TableContainer sx={{ minWidth: 640 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>รหัส EPC</TableCell>
                        <TableCell>สถานะ</TableCell>
                        <TableCell>เข้าสถานะนี้เมื่อ</TableCell>
                        <TableCell align="right">ค้างมาแล้ว</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stuckItems.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{item.epc_code}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              variant="soft"
                              color={STATUS_COLOR[item.status]}
                              label={STATUS_LABEL[item.status] ?? item.status}
                            />
                          </TableCell>
                          <TableCell>{fDateTime(item.updated_at)}</TableCell>
                          <TableCell align="right">
                            <Stack
                              direction="row"
                              spacing={0.5}
                              alignItems="center"
                              justifyContent="flex-end"
                            >
                              <Iconify
                                icon="solar:danger-triangle-bold-duotone"
                                width={16}
                                sx={{ color: 'error.main' }}
                              />
                              <Typography variant="body2" sx={{ color: 'error.main' }}>
                                {item.hours_stuck} ชม. (เกิน {item.max_hours} ชม.)
                              </Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Scrollbar>
            )}
          </Card>
        </Stack>
      )}
    </DashboardContent>
  );
}
