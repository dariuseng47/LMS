'use client';

import { useState, useEffect } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------

function parseEpcCodes(raw) {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

// กรอก/วางรหัส EPC เอง (หรือใช้เครื่องสแกนแบบคีย์บอร์ดยิงลงช่อง) แล้วเพิ่มเข้ารายการเดียวกับที่สแกน
export function ChangeCategoryManualDialog({ open, onClose, onAdd }) {
  const [text, setText] = useState('');
  const codes = parseEpcCodes(text);

  useEffect(() => {
    if (open) setText('');
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>กรอก / วางรหัส EPC</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          วางได้หลายรายการ คั่นด้วยการขึ้นบรรทัดใหม่ เว้นวรรค หรือจุลภาค —
          ใช้เครื่องสแกนที่ต่อกับคอมพิวเตอร์ยิงลงช่องนี้ได้เลย
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={6}
          maxRows={12}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'เช่น\nE28069150000402EBE98B21C\nE28069150000402EBED6660D'}
          inputProps={{ 'aria-label': 'รหัส EPC', style: { fontFamily: 'monospace' } }}
        />
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} sx={{ minHeight: 44 }}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={codes.length === 0}
          onClick={() => onAdd(codes)}
          sx={{ minHeight: 44, px: 2.5 }}
        >
          เพิ่มเข้ารายการ{codes.length > 0 ? ` (${codes.length.toLocaleString('th-TH')})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
