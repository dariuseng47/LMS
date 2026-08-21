'use client';

import { z as zod } from 'zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { createDevice, useGetDevices } from 'src/actions/devices';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field } from 'src/components/hook-form';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { HospitalSelector } from 'src/components/hospital-selector';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { DEVICE_TYPES, DEVICE_TYPE_ICON, DEVICE_TYPE_LABEL } from '../device-constants';

// ----------------------------------------------------------------------

function timeAgo(dateString) {
  if (!dateString) return 'ไม่เคยส่งสัญญาณ';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'เมื่อสักครู่';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`;
  return new Date(dateString).toLocaleString('th-TH');
}

const NewDeviceSchema = zod.object({
  deviceType: zod.enum(DEVICE_TYPES, { message: 'เลือกประเภทอุปกรณ์' }),
  caretakerName: zod.string().optional(),
  caretakerPhone: zod.string().optional(),
  rssiThresholdDbm: zod.coerce.number().int().optional(),
});

function NewDeviceDialog({ open, onClose, onCreated }) {
  const methods = useForm({
    resolver: zodResolver(NewDeviceSchema),
    defaultValues: {
      deviceType: 'WEIGHT_GATE',
      caretakerName: '',
      caretakerPhone: '',
      rssiThresholdDbm: -65,
    },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createDevice(data);
      toast.success('เพิ่มอุปกรณ์สำเร็จ');
      reset();
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'เพิ่มอุปกรณ์ไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>เพิ่มอุปกรณ์ใหม่</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Select name="deviceType" label="ประเภทอุปกรณ์">
            {DEVICE_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {DEVICE_TYPE_LABEL[type]}
              </MenuItem>
            ))}
          </Field.Select>
          <Field.Text name="caretakerName" label="ผู้ดูแลอุปกรณ์ (ถ้ามี)" />
          <Field.Text name="caretakerPhone" label="เบอร์โทรผู้ดูแล (ถ้ามี)" />
          <Field.Text
            name="rssiThresholdDbm"
            label="เกณฑ์สัญญาณ RSSI (dBm)"
            type="number"
            helperText="ค่ายิ่งติดลบมาก ยิ่งต้องอยู่ใกล้เครื่องอ่านมากขึ้นถึงจะนับว่าตรวจพบ"
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            เพิ่มอุปกรณ์
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

export function DeviceListView() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === 'ADMIN';

  const { hospitalId, isSuperadmin, hospitals, selectedHospitalId, setSelectedHospitalId } =
    useEffectiveHospital();

  const [deviceType, setDeviceType] = useState('');
  const dialog = useBoolean();

  const { devices, devicesLoading, refreshDevices } = useGetDevices(
    hospitalId,
    deviceType || undefined
  );

  const stats = useMemo(() => {
    const online = devices.filter((d) => d.status === 'ONLINE').length;
    return { total: devices.length, online, offline: devices.length - online };
  }, [devices]);

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="xl">
        <CustomBreadcrumbs
          heading="อุปกรณ์ & สัญญาณ RFID"
          links={[{ name: 'อุปกรณ์ & สัญญาณ RFID' }]}
          action={
            isAdmin && (
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={dialog.onTrue}
              >
                เพิ่มอุปกรณ์
              </Button>
            )
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {!hospitalId ? (
          <Card>
            <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
          </Card>
        ) : (
          <>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <StatCard
                  icon="solar:cpu-bolt-bold-duotone"
                  title="อุปกรณ์ทั้งหมด"
                  value={stats.total}
                  color="primary"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <StatCard
                  icon="solar:wi-fi-router-bold-duotone"
                  title="ออนไลน์"
                  value={stats.online}
                  color="success"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <StatCard
                  icon="solar:wi-fi-router-minimalistic-broken"
                  title="ออฟไลน์"
                  value={stats.offline}
                  color="error"
                />
              </Grid>
            </Grid>

            <Card sx={{ p: 2.5, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {isSuperadmin && (
                <HospitalSelector
                  hospitals={hospitals}
                  value={selectedHospitalId}
                  onChange={setSelectedHospitalId}
                />
              )}

              <TextField
                select
                size="small"
                label="ประเภทอุปกรณ์"
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">ทั้งหมด</MenuItem>
                {DEVICE_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {DEVICE_TYPE_LABEL[type]}
                  </MenuItem>
                ))}
              </TextField>
            </Card>

            <Card>
              {devicesLoading ? (
                <LoadingScreen />
              ) : devices.length === 0 ? (
                <EmptyContent
                  title="ยังไม่มีอุปกรณ์ในโรงพยาบาลนี้"
                  description={isAdmin ? 'เริ่มต้นด้วยการเพิ่มอุปกรณ์แรก' : undefined}
                  sx={{ py: 10 }}
                />
              ) : (
                <Scrollbar>
                  <TableContainer sx={{ minWidth: 760 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>อุปกรณ์</TableCell>
                          <TableCell>สถานะ</TableCell>
                          <TableCell>เห็นสัญญาณล่าสุด</TableCell>
                          <TableCell>ผู้ดูแล</TableCell>
                          <TableCell align="right">เกณฑ์ RSSI</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {devices.map((device) => (
                          <TableRow key={device.id} hover>
                            <TableCell>
                              <Stack direction="row" spacing={1.5} alignItems="center">
                                <Iconify
                                  icon={DEVICE_TYPE_ICON[device.device_type]}
                                  width={24}
                                  sx={{ color: 'text.secondary' }}
                                />
                                <Stack>
                                  <Typography variant="subtitle2">
                                    {DEVICE_TYPE_LABEL[device.device_type] ?? device.device_type}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    #{device.id}
                                  </Typography>
                                </Stack>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                variant="soft"
                                color={device.status === 'ONLINE' ? 'success' : 'default'}
                                label={device.status === 'ONLINE' ? 'ออนไลน์' : 'ออฟไลน์'}
                              />
                            </TableCell>
                            <TableCell>{timeAgo(device.last_heartbeat_at)}</TableCell>
                            <TableCell>
                              {device.caretaker_name ? (
                                <Stack>
                                  <Typography variant="body2">{device.caretaker_name}</Typography>
                                  {device.caretaker_phone && (
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                      {device.caretaker_phone}
                                    </Typography>
                                  )}
                                </Stack>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell align="right">{device.rssi_threshold_dbm} dBm</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Scrollbar>
              )}
            </Card>
          </>
        )}

        <NewDeviceDialog open={dialog.value} onClose={dialog.onFalse} onCreated={refreshDevices} />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
