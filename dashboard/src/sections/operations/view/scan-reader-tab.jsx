'use client';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';

import { Iconify } from 'src/components/iconify';

import { ReaderOptionList } from 'src/sections/devices/reader-option-list';

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
  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:wi-fi-router-bold-duotone" color="primary" />}
        title="เครื่องอ่าน RFID"
        subheader="เลือกเครื่องอ่านที่ใช้กับหน้านี้ — จำไว้ในเบราว์เซอร์เครื่องนี้"
      />
      <CardContent>
        <ReaderOptionList reader={reader} deviceTypes={[deviceType]} />
      </CardContent>
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
