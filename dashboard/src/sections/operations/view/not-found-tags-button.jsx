'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// แท็กที่ไม่พบในระบบไม่แสดงในรายการสแกน (รับผ้าหลังซัก / สแกนเข้าสต๊อค / สแกนตรวจสอบผ้า)
// ดูได้จากปุ่มนี้ที่เดียว -> เปิด modal รายการรหัส EPC เต็ม
// ให้ผู้เรียก render เฉพาะตอนมีแท็ก (epcs.length > 0) — หมดรายการแล้ว unmount ไปพร้อมสถานะเปิด modal
// ไม่งั้นเคลียร์แล้วเจอแท็กใหม่ modal จะเด้งขึ้นมาเอง
// onRemove (ไม่บังคับ) = มีปุ่มเอารหัสออกจากรายการ
export function NotFoundTagsButton({ epcs, onRemove }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Chip
        clickable
        size="small"
        variant="soft"
        color="warning"
        onClick={() => setOpen(true)}
        icon={<Iconify icon="solar:question-circle-bold" />}
        label={`ไม่พบในระบบ ${epcs.length.toLocaleString('th-TH')} — แตะเพื่อดู`}
      />

      <Dialog fullWidth maxWidth="sm" open={open} onClose={() => setOpen(false)}>
        <DialogTitle sx={{ pb: 1 }}>
          แท็กที่ไม่พบในระบบ ({epcs.length.toLocaleString('th-TH')})
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            รหัสที่ยังไม่ได้ลงทะเบียนในโรงพยาบาลนี้ — ไม่แสดงในรายการสแกนและไม่นับรวมในยอด
          </Typography>

          <Stack spacing={1}>
            {epcs.map((epc) => (
              <Stack
                key={epc}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ px: 1.5, py: 1, borderRadius: 1, bgcolor: 'background.neutral' }}
              >
                <Iconify
                  icon="solar:question-circle-bold-duotone"
                  width={22}
                  sx={{ flexShrink: 0, color: 'warning.main' }}
                />
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
                  {epc}
                </Box>
                {onRemove && (
                  <Tooltip title="เอาออกจากรายการ">
                    <IconButton size="small" onClick={() => onRemove(epc)}>
                      <Iconify icon="mingcute:close-line" width={16} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            ))}
          </Stack>
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
