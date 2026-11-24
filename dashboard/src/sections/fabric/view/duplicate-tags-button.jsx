'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// ของโรงพยาบาลอื่นไม่เปิดเผยประเภท
export function duplicateLabel(duplicate) {
  return duplicate.otherHospital
    ? 'ลงทะเบียนที่โรงพยาบาลอื่นแล้ว'
    : duplicate.categoryName || 'ไม่ระบุประเภท';
}

export function DuplicateTagList({ duplicates }) {
  return (
    <Stack spacing={1}>
      {duplicates.map((duplicate) => (
        <Stack
          key={duplicate.epcCode}
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ px: 1.5, py: 1, borderRadius: 1, bgcolor: 'background.neutral' }}
        >
          <Box
            component="span"
            sx={{
              flex: 1,
              minWidth: 0,
              typography: 'body2',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            {duplicate.epcCode}
          </Box>
          <Label color={duplicate.otherHospital ? 'error' : 'warning'}>
            {duplicateLabel(duplicate)}
          </Label>
        </Stack>
      ))}
    </Stack>
  );
}

// แท็กที่ลงทะเบียนแล้วไม่แสดงในรายการสแกนและไม่นับยอด ดูได้จากปุ่มนี้ (แบบเดียวกับ not-found-tags-button.jsx)
// ให้ผู้เรียก render เฉพาะตอนมีแท็กซ้ำ — หมดแล้ว unmount ไปพร้อมสถานะเปิด modal
export function DuplicateTagsButton({ duplicates }) {
  const [open, setOpen] = useState(false);
  const count = duplicates.length.toLocaleString('th-TH');

  return (
    <>
      <Chip
        clickable
        size="small"
        variant="soft"
        color="warning"
        onClick={() => setOpen(true)}
        icon={<Iconify icon="solar:copy-bold" />}
        label={`ลงทะเบียนแล้ว ${count} — แตะเพื่อดู`}
      />

      <Dialog fullWidth maxWidth="sm" open={open} onClose={() => setOpen(false)}>
        <DialogTitle sx={{ pb: 1 }}>แท็กที่ลงทะเบียนในระบบแล้ว ({count})</DialogTitle>

        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            รหัสเหล่านี้มีในระบบแล้ว จึงไม่แสดงในรายการและไม่ถูกลงทะเบียนซ้ำ
          </Typography>
          <DuplicateTagList duplicates={duplicates} />
        </DialogContent>

        <DialogActions>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setOpen(false)}
            sx={{ minHeight: 44, px: 2.5 }}
          >
            ปิด
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
