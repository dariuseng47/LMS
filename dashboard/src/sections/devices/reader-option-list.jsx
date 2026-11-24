'use client';

import { useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { varAlpha } from 'src/theme/styles';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { deviceName, deviceDetail, DEVICE_TYPE_ICON, DEVICE_TYPE_LABEL } from './device-constants';

// ----------------------------------------------------------------------

// ปุ่มเลือกอุปกรณ์ 1 เครื่อง (radio) — ชื่อ + IP/ผู้ดูแล ใหญ่พอสำหรับจอสัมผัส
function DeviceOptionTile({ device, detail, selected, onSelect, labels }) {
  return (
    <ButtonBase
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      sx={(theme) => ({
        p: 1.5,
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
      <Iconify
        icon={DEVICE_TYPE_ICON[device.device_type]}
        width={28}
        sx={{ flexShrink: 0, color: selected ? 'primary.main' : 'text.secondary' }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ lineHeight: 1.35 }}>
          {deviceName(device.device_type)}
        </Typography>
        {detail && (
          <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
            {detail}
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
        {labels}
      </Stack>
    </ButtonBase>
  );
}

// ----------------------------------------------------------------------

/**
 * รายการเครื่องอ่าน RFID ให้เลือก (แท็บ "เครื่องอ่าน" ของหน้าสแกน / popup ตั้งค่าเครื่องสแกนหน้าลงทะเบียนผ้า)
 * reader = ผลจาก useScanReader | deviceTypes = ประเภทที่เลือกได้ มากกว่า 1 ประเภท -> แบ่งกลุ่มตามประเภท
 */
export function ReaderOptionList({ reader, deviceTypes }) {
  const { devices, devicesLoading, devicesError, refreshDevices, deviceId, defaultId, selectDevice } =
    reader;

  // รายการเครื่องอ่านถูกแคชไว้ — เปิดทีไรดึงใหม่ เผื่อเพิ่งเพิ่มเครื่อง/เปลี่ยนค่าเริ่มต้น
  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  if (devicesLoading) return <LoadingScreen sx={{ minHeight: 160 }} />;

  if (devicesError && devices.length === 0) {
    return (
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
    );
  }

  const typeLabels = deviceTypes.map((type) => `“${DEVICE_TYPE_LABEL[type] ?? type}”`);

  if (devices.length === 0) {
    return (
      <EmptyContent
        title="ยังไม่มีเครื่องอ่าน"
        description={`เพิ่มอุปกรณ์ประเภท ${typeLabels.join(' หรือ ')} ในหน้า “อุปกรณ์ & สัญญาณ RFID” ก่อน (ระบุ IP/Port ของเครื่องอ่าน)`}
        sx={{ py: 6 }}
      />
    );
  }

  const renderTile = (device) => {
    const selected = device.id === deviceId;
    return (
      <DeviceOptionTile
        key={device.id}
        device={device}
        detail={
          deviceDetail({
            ipAddress: device.ip_address,
            port: device.port,
            caretakerName: device.caretaker_name,
          }) || 'ยังไม่ได้ตั้ง IP/Port'
        }
        selected={selected}
        onSelect={() => selectDevice(device.id)}
        labels={
          <>
            {device.id === defaultId && <Label color="info">ค่าเริ่มต้น</Label>}
            {selected && <Label color="success">ใช้อยู่</Label>}
          </>
        }
      />
    );
  };

  if (deviceTypes.length === 1) {
    return (
      <Stack spacing={1.5} role="radiogroup" aria-label="เครื่องอ่าน">
        {devices.map(renderTile)}
      </Stack>
    );
  }

  return (
    <Stack spacing={3} role="radiogroup" aria-label="เครื่องอ่าน">
      {deviceTypes.map((type) => {
        const typeDevices = devices.filter((device) => device.device_type === type);
        return (
          <Stack key={type} spacing={1.5}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              {DEVICE_TYPE_LABEL[type] ?? type}
            </Typography>
            {typeDevices.length > 0 ? (
              typeDevices.map(renderTile)
            ) : (
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                ยังไม่มีอุปกรณ์ประเภทนี้ — เพิ่มได้ในหน้า “อุปกรณ์ & สัญญาณ RFID”
              </Typography>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}
