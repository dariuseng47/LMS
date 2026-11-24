'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// หัวข้อขั้นตอน — ทำเสร็จแล้วเลขขั้นเปลี่ยนเป็นเครื่องหมายถูกสีเขียว | caption = บรรทัดรอง (ไม่บังคับ)
export function ChangeCategoryStepTitle({ step, title, caption, done }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          flexShrink: 0,
          display: 'flex',
          borderRadius: '50%',
          alignItems: 'center',
          justifyContent: 'center',
          typography: 'subtitle1',
          color: 'common.white',
          bgcolor: done ? 'success.main' : 'primary.main',
          transition: (theme) => theme.transitions.create('background-color'),
        }}
      >
        {done ? <Iconify icon="eva:checkmark-fill" width={20} /> : step}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" noWrap>
          {title}
        </Typography>
        {caption && (
          <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary' }}>
            {caption}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
