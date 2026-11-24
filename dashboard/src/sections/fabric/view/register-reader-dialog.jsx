'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { ReaderOptionList } from 'src/sections/devices/reader-option-list';

// ----------------------------------------------------------------------

// popup "ตั้งค่าเครื่องสแกน" — เลือกว่าจะสแกนที่จุดไหน (ประตูชั่งน้ำหนัก / เครื่องอ่าน RFID ที่จุดตรวจสอบ)
export function RegisterReaderDialog({ open, onClose, reader, deviceTypes }) {
  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle sx={{ pb: 1 }}>ตั้งค่าเครื่องสแกน</DialogTitle>

      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2.5, color: 'text.secondary' }}>
          เลือกจุดที่จะสแกนลงทะเบียนผ้า — จำไว้ในเบราว์เซอร์เครื่องนี้
        </Typography>
        <ReaderOptionList reader={reader} deviceTypes={deviceTypes} />
      </DialogContent>

      <DialogActions>
        <Button variant="contained" onClick={onClose} sx={{ minHeight: 44, px: 3 }}>
          เสร็จสิ้น
        </Button>
      </DialogActions>
    </Dialog>
  );
}
