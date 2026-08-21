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
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { createDevice, useGetDevices, rotateDeviceToken } from 'src/actions/devices';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field } from 'src/components/hook-form';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

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

// 🟢 online (<60 วิ) / 🟡 delayed (60 วิ–5 นาที) / 🔴 offline (>5 นาที หรือไม่เคยส่งสัญญาณ)
// ตาม docs/device-network-failure-handling.md หัวข้อ 4 — ใช้ last_heartbeat_at จริง
// เป็นตัวตัดสิน ไม่ใช้แค่คอลัมน์ status ดิบ เพราะ status ขยับช้ากว่า heartbeat จริงเสมอ
// (scheduled job เช็คทุก 60 วิ) การไล่สีตามเวลาให้ภาพที่ตรงกว่า
function heartbeatTier(dateString) {
  if (!dateString) return { color: 'error', label: 'ออฟไลน์' };
  const diffSec = (Date.now() - new Date(dateString).getTime()) / 1000;
  if (diffSec < 60) return { color: 'success', label: 'ออนไลน์' };
  if (diffSec < 300) return { color: 'warning', label: 'สัญญาณช้า' };
  return { color: 'error', label: 'ออฟไลน์' };
}

function DeviceTokenDialog({ open, onClose, deviceToken }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(deviceToken);
    toast.success('คัดลอก token แล้ว');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Device Token</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          นำ token นี้ไปตั้งค่าใน edge agent (Raspberry Pi) เพื่อใช้ยิง heartbeat —
          <b> จะแสดงให้เห็นครั้งนี้ครั้งเดียวเท่านั้น</b> หากทำหายต้องกดรีเซ็ต token ใหม่
        </Typography>
        <TextField
          fullWidth
          value={deviceToken}
          InputProps={{
            readOnly: true,
            sx: { fontFamily: 'monospace', fontSize: 13 },
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleCopy}>
                  <Iconify icon="solar:copy-bold-duotone" width={20} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
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
      const result = await createDevice(data);
      toast.success('เพิ่มอุปกรณ์สำเร็จ');
      reset();
      onCreated(result.deviceToken);
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

  const { hospitalId } = useEffectiveHospital();

  const [deviceType, setDeviceType] = useState('');
  const dialog = useBoolean();
  const tokenDialog = useBoolean();
  const [deviceToken, setDeviceToken] = useState('');
  const [rotatingId, setRotatingId] = useState(null);

  const { devices, devicesLoading, refreshDevices } = useGetDevices(
    hospitalId,
    deviceType || undefined
  );

  const stats = useMemo(() => {
    const online = devices.filter(
      (d) => heartbeatTier(d.last_heartbeat_at).label === 'ออนไลน์'
    ).length;
    return { total: devices.length, online, offline: devices.length - online };
  }, [devices]);

  const handleCreated = (token) => {
    refreshDevices();
    setDeviceToken(token);
    tokenDialog.onTrue();
  };

  const handleRotateToken = async (device) => {
    setRotatingId(device.id);
    try {
      const result = await rotateDeviceToken(device.id);
      setDeviceToken(result.deviceToken);
      tokenDialog.onTrue();
    } catch (error) {
      toast.error(error?.message || 'รีเซ็ต token ไม่สำเร็จ');
    } finally {
      setRotatingId(null);
    }
  };

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

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
                          {isAdmin && <TableCell align="right">Device Token</TableCell>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {devices.map((device) => {
                          const tier = heartbeatTier(device.last_heartbeat_at);
                          return (
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
                                <Chip size="small" variant="soft" color={tier.color} label={tier.label} />
                              </TableCell>
                              <TableCell>{timeAgo(device.last_heartbeat_at)}</TableCell>
                              <TableCell>
                                {device.caretaker_name ? (
                                  <Stack>
                                    <Typography variant="body2">{device.caretaker_name}</Typography>
                                    {device.caretaker_phone && (
                                      <Typography
                                        component="a"
                                        href={`tel:${device.caretaker_phone}`}
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}
                                      >
                                        {device.caretaker_phone}
                                      </Typography>
                                    )}
                                  </Stack>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell align="right">{device.rssi_threshold_dbm} dBm</TableCell>
                              {isAdmin && (
                                <TableCell align="right">
                                  <Tooltip title="รีเซ็ต device token">
                                    <IconButton
                                      size="small"
                                      disabled={rotatingId === device.id}
                                      onClick={() => handleRotateToken(device)}
                                    >
                                      <Iconify icon="solar:refresh-bold-duotone" width={18} />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Scrollbar>
              )}
            </Card>
          </>
        )}

        <NewDeviceDialog open={dialog.value} onClose={dialog.onFalse} onCreated={handleCreated} />
        <DeviceTokenDialog
          open={tokenDialog.value}
          onClose={tokenDialog.onFalse}
          deviceToken={deviceToken}
        />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
