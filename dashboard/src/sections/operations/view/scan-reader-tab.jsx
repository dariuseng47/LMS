'use client';

import { useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import CardHeader from '@mui/material/CardHeader';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { varAlpha } from 'src/theme/styles';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { DEVICE_TYPE_LABEL } from 'src/sections/devices/device-constants';

import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

export const READER_TAB = {
  value: 'reader',
  label: 'เครื่องอ่าน',
  icon: <Iconify icon="solar:wi-fi-router-bold-duotone" width={22} />,
};

// แท็บ "เครื่องอ่าน" ของหน้าสแกน (รับผ้าหลังซัก / สแกนเข้าสต๊อค / สแกนตรวจสอบผ้า) — ย้ายการเลือกเครื่องอ่าน
// ออกจากหน้าสแกนมาไว้ที่นี่ที่เดียว reader = ผลจาก useScanReader
export function ScanReaderTab({ reader, deviceType }) {
  const {
    devices,
    devicesLoading,
    devicesError,
    refreshDevices,
    deviceId,
    defaultId,
    selectDevice,
  } = reader;

  // รายการเครื่องอ่านถูกแคชไว้ — เปิดแท็บนี้ทีไรดึงใหม่ เผื่อเพิ่งเพิ่มเครื่อง/เปลี่ยนค่าเริ่มต้น
  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const typeLabel = DEVICE_TYPE_LABEL[deviceType] ?? deviceType;

  const renderContent = () => {
    if (devicesLoading) return <LoadingScreen />;

    if (devices.length === 0) {
      return devicesError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refreshDevices()}>
              ลองใหม่
            </Button>
          }
        >
          โหลดรายการเครื่องอ่านไม่สำเร็จ
        </Alert>
      ) : (
        <EmptyContent
          title="ยังไม่มีเครื่องอ่าน"
          description={`เพิ่มอุปกรณ์ประเภท “${typeLabel}” ในหน้า “อุปกรณ์ & สัญญาณ RFID” ก่อน (ระบุ IP/Port ของเครื่องอ่าน)`}
          sx={{ py: 6 }}
        />
      );
    }

    return (
      <Stack spacing={1.5} role="radiogroup" aria-label="เครื่องอ่าน">
        {devices.map((device) => {
          const selected = device.id === deviceId;
          return (
            <ButtonBase
              key={device.id}
              role="radio"
              aria-checked={selected}
              onClick={() => selectDevice(device.id)}
              sx={(theme) => ({
                p: 2,
                gap: 1.5,
                width: 1,
                minHeight: 72,
                textAlign: 'left',
                borderRadius: 1.5,
                justifyContent: 'flex-start',
                border: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.24)}`,
                '&:hover': { bgcolor: 'action.hover' },
                ...(selected && {
                  borderColor: 'primary.main',
                  bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
                }),
              })}
            >
              <Radio
                checked={selected}
                tabIndex={-1}
                disableRipple
                inputProps={{ 'aria-hidden': true }}
                sx={{ p: 0, pointerEvents: 'none' }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1">เครื่องอ่าน #{device.id}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                  {device.ip_address
                    ? `${device.ip_address}:${device.port}`
                    : 'ยังไม่ได้ตั้ง IP/Port'}
                </Typography>
              </Box>
              {device.id === defaultId && <Label color="info">ค่าเริ่มต้น</Label>}
              {selected && <Label color="success">ใช้อยู่</Label>}
            </ButtonBase>
          );
        })}
      </Stack>
    );
  };

  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:wi-fi-router-bold-duotone" color="primary" />}
        title="เครื่องอ่าน RFID"
        subheader="เลือกเครื่องอ่านที่ใช้กับหน้านี้ — จำไว้ในเบราว์เซอร์เครื่องนี้"
      />
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

// แถบเตือนบนหน้าสแกนเมื่อมีเครื่องอ่านแต่ยังไม่ได้เลือก (หน้าสแกนไม่มีตัวเลือกแล้ว ต้องพาไปแท็บเครื่องอ่าน)
export function ReaderNotSelectedAlert({ reader, onOpenReader }) {
  if (reader.devices.length === 0 || reader.deviceId) return null;

  return (
    <Alert
      severity="warning"
      sx={{ flexShrink: 0 }}
      action={
        <Button color="inherit" size="small" onClick={onOpenReader} sx={{ minHeight: 36 }}>
          เลือกเครื่องอ่าน
        </Button>
      }
    >
      ยังไม่ได้เลือกเครื่องอ่าน
    </Alert>
  );
}
