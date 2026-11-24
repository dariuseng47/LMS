'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';

import { varAlpha } from 'src/theme/styles';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// โครง popup เลือกรายการ (ประเภทผ้า / ล็อต) — ค้นหาได้ สูงคงที่ ค้นหาแล้ว popup ไม่ยืดหด
export function RegisterOptionDialog({
  open,
  onClose,
  title,
  search,
  onSearch,
  searchPlaceholder,
  addLabel,
  onAdd,
  children,
}) {
  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>

      <Box sx={{ px: 3, pb: 2 }}>
        <TextField
          fullWidth
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={searchPlaceholder}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <DialogContent sx={{ height: 440, overscrollBehavior: 'contain' }}>{children}</DialogContent>

      <DialogActions>
        {onAdd && (
          <Button
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={onAdd}
            sx={{ mr: 'auto' }}
          >
            {addLabel}
          </Button>
        )}
        <Button variant="outlined" color="inherit" onClick={onClose}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ใหญ่พอสำหรับจอสัมผัส
export function OptionTile({ selected, onClick, children }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={(theme) => ({
        px: 2,
        py: 1.25,
        width: 1,
        gap: 1.5,
        minHeight: 60,
        textAlign: 'left',
        borderRadius: 1.5,
        justifyContent: 'flex-start',
        border: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.2)}`,
        '&:hover': { bgcolor: 'action.hover' },
        ...(selected && {
          borderColor: 'primary.main',
          bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
        }),
      })}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      {selected && (
        <Iconify
          icon="eva:checkmark-circle-2-fill"
          width={24}
          sx={{ flexShrink: 0, color: 'primary.main' }}
        />
      )}
    </ButtonBase>
  );
}

// แถบ "ลงทะเบียนแล้ว 60/100" (progress = lotProgress / lineProgress) — ไม่มีจำนวนสั่งซื้อให้เทียบ = แสดงแค่จำนวนชิ้น
export function RegisterProgress({ progress, sx }) {
  const { registered, quantity, percent, isFull } = progress;

  if (quantity === null) {
    return (
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', ...sx }}>
        ลงทะเบียนแล้ว {registered.toLocaleString('th-TH')} ชิ้น
      </Typography>
    );
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={sx}>
      <LinearProgress
        variant="determinate"
        value={percent}
        color={isFull ? 'success' : 'primary'}
        sx={{ flex: 1, minWidth: 48, height: 6, borderRadius: 1 }}
      />
      <Typography variant="caption" sx={{ flexShrink: 0, color: 'text.secondary' }}>
        ลงทะเบียนแล้ว {registered.toLocaleString('th-TH')}/{quantity.toLocaleString('th-TH')}
      </Typography>
    </Stack>
  );
}
