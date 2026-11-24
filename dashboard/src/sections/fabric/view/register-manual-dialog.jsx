'use client';

import { useMemo, useState, useEffect } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------

const MAX_EPC_LENGTH = 64; // ต้องตรงกับ epcCodes ใน server/src/schemas/fabric.schema.js

// วางกี่รายการก็ได้ คั่นด้วยขึ้นบรรทัดใหม่/คอมมา/เว้นวรรค
function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).filter(Boolean))];
}

// popup พิมพ์/วางรหัส EPC เอง (แทนแท็บ "ลงทะเบียนรายชิ้น" เดิม) — เพิ่มเข้ารายการเดียวกับที่สแกนได้
export function RegisterManualDialog({ open, onClose, onAdd }) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText('');
  }, [open]);

  const { codes, tooLongCount } = useMemo(() => {
    const parsed = parseEpcCodes(text);
    const valid = parsed.filter((code) => code.length <= MAX_EPC_LENGTH);
    return { codes: valid, tooLongCount: parsed.length - valid.length };
  }, [text]);

  const handleAdd = () => {
    onAdd(codes);
    onClose();
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle sx={{ pb: 1 }}>พิมพ์ / วางรหัส EPC</DialogTitle>

      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          วางได้หลายรายการพร้อมกัน คั่นด้วยการขึ้นบรรทัดใหม่ เว้นวรรค หรือจุลภาค
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={6}
          maxRows={14}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'เช่น\nE2801160600002...\nE2801160600003...'}
          inputProps={{ style: { fontFamily: 'monospace' } }}
          error={tooLongCount > 0}
          helperText={
            tooLongCount > 0
              ? `มี ${tooLongCount} รหัสยาวเกิน ${MAX_EPC_LENGTH} ตัวอักษร — จะไม่ถูกเพิ่ม`
              : undefined
          }
        />
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button variant="contained" disabled={codes.length === 0} onClick={handleAdd}>
          เพิ่มเข้ารายการ ({codes.length.toLocaleString('th-TH')})
        </Button>
      </DialogActions>
    </Dialog>
  );
}
