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
import IconButton from '@mui/material/IconButton';
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

// ----------------------------------------------------------------------

const ALL_GROUPS = 'all';
const NO_GROUP = 'none';
const groupKeyOf = (category) => category.group_id ?? NO_GROUP;

// เลือกประเภทผ้าปลายทางแบบแตะการ์ด (จอทัชไม่ต้องพิมพ์) — กรองตามหมวดหมู่ / ค้นหาได้ แตะแล้วเลือกและปิดทันที
// fromCounts = Map<categoryId, จำนวนผ้าที่เลือกไว้ซึ่งอยู่ประเภทนั้น> ใช้ติดป้าย "ประเภทปัจจุบัน"
export function ChangeCategoryTargetDialog({
  open,
  categories,
  value,
  fromCounts,
  onClose,
  onSelect,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [search, setSearch] = useState('');
  const [groupKey, setGroupKey] = useState(ALL_GROUPS);

  // เปิดใหม่ = เริ่มจากรายการทั้งหมด
  useEffect(() => {
    if (open) {
      setSearch('');
      setGroupKey(ALL_GROUPS);
    }
  }, [open]);

  const groupOptions = useMemo(() => {
    const map = new Map();
    categories.forEach((category) => {
      const key = groupKeyOf(category);
      const current = map.get(key);
      if (current) current.count += 1;
      else map.set(key, { key, name: category.group_name || 'ไม่ระบุหมวดหมู่', count: 1 });
    });
    return [...map.values()].sort(
      (a, b) => (a.key === NO_GROUP) - (b.key === NO_GROUP) || a.name.localeCompare(b.name, 'th')
    );
  }, [categories]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      categories
        .filter((category) => {
          if (groupKey !== ALL_GROUPS && groupKeyOf(category) !== groupKey) return false;
          if (!query) return true;
          return [category.name, category.group_name, category.description].some((text) =>
            (text || '').toLowerCase().includes(query)
          );
        })
        .sort(
          (a, b) =>
            (a.group_name || '').localeCompare(b.group_name || '', 'th') ||
            a.name.localeCompare(b.name, 'th')
        ),
    [categories, groupKey, query]
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle sx={{ pb: 1.5 }}>เลือกประเภทผ้าปลายทาง</DialogTitle>

      <Stack spacing={1.5} sx={{ px: 3, pb: 2 }}>
        <TextField
          fullWidth
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาประเภทผ้า / หมวดหมู่"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="ล้างคำค้นหา" onClick={() => setSearch('')}>
                  <Iconify icon="mingcute:close-line" width={16} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        {groupOptions.length > 1 && (
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {[
              { key: ALL_GROUPS, name: 'ทุกหมวดหมู่', count: categories.length },
              ...groupOptions,
            ].map((group) => (
              <Chip
                key={group.key}
                clickable
                color={groupKey === group.key ? 'primary' : 'default'}
                variant={groupKey === group.key ? 'filled' : 'soft'}
                onClick={() => setGroupKey(group.key)}
                label={`${group.name} ${group.count}`}
                sx={{ height: 36 }}
              />
            ))}
          </Stack>
        )}
      </Stack>

      {/* สูงคงที่ — กรอง/ค้นหาแล้วรายการสั้นลง dialog ไม่หดกระโดด */}
      <DialogContent dividers sx={{ py: 2, ...(!fullScreen && { height: 420 }) }}>
        {visible.length === 0 ? (
          <EmptyContent
            title={categories.length === 0 ? 'ยังไม่มีประเภทผ้า' : 'ไม่พบประเภทผ้า'}
            description={
              categories.length === 0
                ? 'เพิ่มประเภทผ้าในหน้า “ลงทะเบียนผ้าใหม่” ก่อน'
                : 'ลองเปลี่ยนคำค้นหา หรือเลือก “ทุกหมวดหมู่”'
            }
            slotProps={{ img: { maxWidth: 120 } }}
          />
        ) : (
          <Box
            sx={{
              gap: 1.5,
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {visible.map((category) => {
              const selected = category.id === value?.id;
              const fromCount = fromCounts.get(Number(category.id)) ?? 0;
              return (
                <ButtonBase
                  key={category.id}
                  aria-pressed={selected}
                  onClick={() => onSelect(category)}
                  sx={{
                    p: 1.5,
                    gap: 1.5,
                    minHeight: 76,
                    textAlign: 'left',
                    borderRadius: 1.5,
                    justifyContent: 'flex-start',
                    border: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.2)}`,
                    transition: theme.transitions.create(['border-color', 'box-shadow']),
                    '&:hover': { borderColor: 'primary.main', boxShadow: theme.customShadows?.z8 },
                    ...(selected && {
                      borderColor: 'primary.main',
                      bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
                      boxShadow: `inset 0 0 0 1px ${theme.vars.palette.primary.main}`,
                    }),
                  }}
                >
                  <Avatar
                    variant="rounded"
                    sx={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      borderRadius: 1.5,
                      color: selected ? 'primary.contrastText' : 'primary.main',
                      bgcolor: selected
                        ? 'primary.main'
                        : varAlpha(theme.vars.palette.primary.mainChannel, 0.1),
                    }}
                  >
                    <Iconify
                      icon={selected ? 'eva:checkmark-fill' : 'solar:t-shirt-bold-duotone'}
                      width={26}
                    />
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ lineHeight: 1.35 }}>
                      {category.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      component="div"
                      noWrap
                      sx={{ color: 'text.secondary' }}
                    >
                      {category.group_name || 'ไม่ระบุหมวดหมู่'}
                      {` · ${Number(category.item_count || 0).toLocaleString('th-TH')} ชิ้น`}
                    </Typography>
                    {fromCount > 0 && (
                      <Label color="warning" sx={{ mt: 0.5 }}>
                        ประเภทปัจจุบันของผ้าที่เลือก {fromCount}
                      </Label>
                    )}
                  </Box>
                </ButtonBase>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onClose}
          sx={{ minHeight: 44, px: 2.5 }}
        >
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}
