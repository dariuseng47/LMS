'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import useMediaQuery from '@mui/material/useMediaQuery';
import InputAdornment from '@mui/material/InputAdornment';

import { varAlpha } from 'src/theme/styles';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

const formatCount = (n) => n.toLocaleString('th-TH');

// สถานะตู้ตามแผน "จัดผ้าเข้ารถ" — ใช้ทั้งในตัวเลือกและการ์ดตู้ปลายทาง
export function cabinetPlanState(cabinet) {
  if (!cabinet?.hasParConfig) {
    return { color: 'default', icon: 'solar:box-bold-duotone', label: 'ยังไม่ตั้ง Par' };
  }
  if (cabinet.totalSuggestedLoad > 0) {
    return {
      color: 'warning',
      icon: 'solar:box-bold-duotone',
      label: `ต้องเติม ${formatCount(cabinet.totalSuggestedLoad)} ชิ้น`,
    };
  }
  return { color: 'success', icon: 'solar:box-minimalistic-bold-duotone', label: 'ครบ Par แล้ว' };
}

// ประเภทที่ต้องเติมของตู้ (สั้น ๆ) เช่น "ผ้าปูเตียง 5 · ปลอกหมอน 3 · +2 ประเภท"
export function cabinetNeedSummary(cabinet, max = 2) {
  const needs = (cabinet?.lines ?? []).filter((line) => line.suggestedLoadQty > 0);
  if (needs.length === 0) return '';
  const head = needs
    .slice(0, max)
    .map((line) => `${line.categoryName} ${formatCount(line.suggestedLoadQty)}`)
    .join(' · ');
  return needs.length > max ? `${head} · +${needs.length - max} ประเภท` : head;
}

const FILTERS = [
  { value: 'need', label: 'ต้องเติม' },
  { value: 'all', label: 'ทุกตู้' },
];

// เลือกตู้ปลายทางแบบแตะการ์ด (จอทัชไม่ต้องพิมพ์) — แยกตามวอร์ด บอกว่าตู้ไหนต้องเติมกี่ชิ้นตามแผนจัดผ้าเข้ารถ
// cabinets = cabinets จาก GET /restock-cart-plan (ทุกตู้ของโรงพยาบาล เรียงตามวอร์ด/ชื่อตู้)
export function WardCabinetPickerDialog({ open, cabinets, loading, value, onSelect, onClose }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const needCount = cabinets.filter((c) => c.totalSuggestedLoad > 0).length;
  const [filter, setFilter] = useState('need');
  const [search, setSearch] = useState('');

  // เปิดใหม่ = เริ่มที่ "ต้องเติม" ถ้ามีตู้ที่ต้องเติม ไม่งั้นทุกตู้
  useEffect(() => {
    if (open) {
      setSearch('');
      setFilter(needCount > 0 ? 'need' : 'all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const query = search.trim().toLowerCase();
  const wards = useMemo(() => {
    const map = new Map();
    cabinets
      .filter((c) => filter === 'all' || c.totalSuggestedLoad > 0)
      .filter(
        (c) =>
          !query || [c.cabinetName, c.wardName].some((text) => text?.toLowerCase().includes(query))
      )
      .forEach((cabinet) => {
        const key = cabinet.wardId ?? cabinet.wardName;
        if (!map.has(key)) map.set(key, { key, name: cabinet.wardName, cabinets: [] });
        map.get(key).cabinets.push(cabinet);
      });
    return [...map.values()];
  }, [cabinets, filter, query]);

  const filterCount = { need: needCount, all: cabinets.length };

  let content;
  if (loading) content = <LoadingScreen sx={{ height: 240 }} />;
  else if (cabinets.length === 0) {
    content = (
      <EmptyContent
        title="ยังไม่มีตู้ผ้าในโรงพยาบาลนี้"
        description="เพิ่มตู้ได้ที่หน้าโครงสร้างโรงพยาบาล"
        sx={{ py: 6 }}
      />
    );
  } else if (wards.length === 0) {
    content = <EmptyContent title="ไม่พบตู้ที่ตรงกับการค้นหา" sx={{ py: 6 }} />;
  } else {
    content = (
      <Stack spacing={2.5}>
        {wards.map((ward) => (
          <Box key={ward.key}>
            <Typography
              variant="overline"
              sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
            >
              {ward.name}
            </Typography>
            <Box
              sx={{
                gap: 1.25,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {ward.cabinets.map((cabinet) => {
                const state = cabinetPlanState(cabinet);
                const selected = cabinet.cabinetId === value;
                const need = cabinetNeedSummary(cabinet);
                return (
                  <ButtonBase
                    key={cabinet.cabinetId}
                    onClick={() => onSelect(cabinet.cabinetId)}
                    aria-pressed={selected}
                    sx={{
                      p: 1.5,
                      gap: 1.5,
                      width: 1,
                      minHeight: 76,
                      textAlign: 'left',
                      borderRadius: 1.5,
                      justifyContent: 'flex-start',
                      border: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.24)}`,
                      transition: theme.transitions.create(['background-color', 'border-color']),
                      '&:hover': { bgcolor: 'action.hover' },
                      ...(selected && {
                        borderWidth: 2,
                        borderColor: 'primary.main',
                        bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
                      }),
                    }}
                  >
                    <Avatar
                      variant="rounded"
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        color: state.color === 'default' ? 'text.secondary' : `${state.color}.dark`,
                        bgcolor:
                          state.color === 'default'
                            ? varAlpha(theme.vars.palette.grey['500Channel'], 0.12)
                            : varAlpha(theme.vars.palette[state.color].mainChannel, 0.14),
                      }}
                    >
                      <Iconify icon={state.icon} width={24} />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" noWrap sx={{ flex: 1, minWidth: 0 }}>
                          {cabinet.cabinetName}
                        </Typography>
                        {selected && (
                          <Iconify
                            icon="solar:check-circle-bold"
                            width={22}
                            sx={{ color: 'primary.main', flexShrink: 0 }}
                          />
                        )}
                      </Stack>
                      <Label color={state.color} sx={{ mt: 0.5 }}>
                        {state.label}
                      </Label>
                      {need && (
                        <Typography
                          variant="caption"
                          component="div"
                          noWrap
                          sx={{ mt: 0.5, color: 'text.secondary' }}
                        >
                          {need}
                        </Typography>
                      )}
                    </Box>
                  </ButtonBase>
                );
              })}
            </Box>
          </Box>
        ))}
      </Stack>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle sx={{ pb: 1 }}>เลือกตู้ปลายทาง</DialogTitle>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        sx={{ px: 3, pb: 2 }}
      >
        <Stack direction="row" spacing={1}>
          {FILTERS.map((f) => (
            <Chip
              key={f.value}
              clickable
              color={filter === f.value ? 'primary' : 'default'}
              variant={filter === f.value ? 'filled' : 'soft'}
              onClick={() => setFilter(f.value)}
              label={`${f.label} ${formatCount(filterCount[f.value])}`}
              sx={{ height: 36 }}
            />
          ))}
        </Stack>
        <TextField
          fullWidth
          size="small"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาชื่อตู้ / วอร์ด"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
      </Stack>
      <DialogContent dividers>{content}</DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose} sx={{ minHeight: 44 }}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}
