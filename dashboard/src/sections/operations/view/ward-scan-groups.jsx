'use client';

import { memo, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
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
import CircularProgress from '@mui/material/CircularProgress';

import { varAlpha, stylesMode } from 'src/theme/styles';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { STATUS_LABEL, STATUS_COLOR } from 'src/sections/fabric/fabric-constants';

import { SKIP_KIND_META } from './use-ward-scan-list';

// ----------------------------------------------------------------------

const formatCount = (n) => n.toLocaleString('th-TH');

// แท็กในกล่องรายการแสดงได้ไม่เกินนี้ (ค้นหาเพื่อดูชิ้นอื่น) — กัน dialog หน่วงตอนสแกนทั้งคัน
const MAX_DIALOG_ROWS = 300;

function softBorder(theme) {
  return `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`;
}

// ----------------------------------------------------------------------

// วงแหวนความคืบหน้าของประเภทผ้า 1 ประเภท — ครบแล้วเปลี่ยนเป็นเครื่องหมายถูก (เด้งเบา ๆ ตอนครบ)
function ProgressRing({ percent, done }) {
  const size = 56;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={size}
        thickness={4.5}
        sx={(theme) => ({
          position: 'absolute',
          color: varAlpha(theme.vars.palette.grey['500Channel'], 0.16),
        })}
      />
      <CircularProgress
        variant="determinate"
        value={percent}
        size={size}
        thickness={4.5}
        color={done ? 'success' : 'primary'}
        sx={{ position: 'absolute', '& circle': { strokeLinecap: 'round' } }}
      />
      <Box
        sx={{
          inset: 0,
          display: 'flex',
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {done ? (
          <Iconify
            icon="eva:checkmark-fill"
            width={30}
            sx={{
              color: 'success.main',
              animation: 'wardPlanDone 420ms cubic-bezier(.34,1.56,.64,1)',
              '@keyframes wardPlanDone': {
                from: { transform: 'scale(0.2)', opacity: 0 },
                to: { transform: 'scale(1)', opacity: 1 },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          />
        ) : (
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {percent}%
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// การ์ดประเภทผ้าตามแผน "จัดผ้าเข้ารถ" ของตู้ปลายทาง: สแกนได้ / ต้องเติม — ครบหรือเกิน = เรียบร้อย (สีเขียว)
// แตะการ์ด = ดูรายแท็กของประเภทนี้
export const WardPlanCard = memo(({ row, onOpen }) => {
  const { name, target, scanned, done } = row;
  const percent = Math.min(100, Math.round((scanned / target) * 100));
  const over = scanned - target;

  return (
    <ButtonBase
      component="div"
      disabled={scanned === 0}
      onClick={scanned > 0 ? () => onOpen(row) : undefined}
      aria-label={`${name} สแกนได้ ${scanned} จาก ${target} ชิ้น`}
      sx={(theme) => ({
        p: 1.5,
        gap: 1.5,
        width: 1,
        display: 'flex',
        textAlign: 'left',
        alignItems: 'center',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        border: softBorder(theme),
        transition: theme.transitions.create(['background-color', 'border-color', 'box-shadow']),
        '&.Mui-disabled': { pointerEvents: 'auto', cursor: 'default' },
        ...(scanned > 0 && { '&:hover': { boxShadow: theme.customShadows?.z8 } }),
        ...(done && {
          borderColor: varAlpha(theme.vars.palette.success.mainChannel, 0.48),
          bgcolor: varAlpha(theme.vars.palette.success.mainChannel, 0.08),
        }),
      })}
    >
      <ProgressRing percent={percent} done={done} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {name}
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={0.75}>
          <Typography
            variant="h4"
            sx={{
              lineHeight: 1.2,
              color: done ? 'success.dark' : 'text.primary',
              [stylesMode.dark]: done ? { color: 'success.light' } : {},
            }}
          >
            {formatCount(scanned)}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
            / {formatCount(target)} ชิ้น
          </Typography>
        </Stack>
      </Box>

      <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
        {done ? (
          <Label color="success" startIcon={<Iconify icon="solar:check-circle-bold" />}>
            ครบแล้ว
          </Label>
        ) : (
          <Label color={scanned > 0 ? 'warning' : 'default'}>
            ขาด {formatCount(target - scanned)}
          </Label>
        )}
        {over > 0 && <Label color="info">เกิน +{formatCount(over)}</Label>}
      </Stack>
    </ButtonBase>
  );
});

// ประเภทที่สแกนมาแต่ไม่อยู่ในแผนของตู้นี้ — ยังจ่ายได้ แค่เตือนให้เห็น
export const WardExtraCard = memo(({ row, onOpen }) => (
  <ButtonBase
    component="div"
    onClick={() => onOpen(row)}
    sx={(theme) => ({
      p: 1.5,
      gap: 1.5,
      width: 1,
      display: 'flex',
      textAlign: 'left',
      alignItems: 'center',
      borderRadius: 1.5,
      bgcolor: 'background.paper',
      border: `1px dashed ${varAlpha(theme.vars.palette.warning.mainChannel, 0.56)}`,
      '&:hover': { boxShadow: theme.customShadows?.z8 },
    })}
  >
    <Avatar
      variant="rounded"
      sx={(theme) => ({
        width: 56,
        height: 56,
        borderRadius: 1.5,
        color: 'warning.dark',
        bgcolor: varAlpha(theme.vars.palette.warning.mainChannel, 0.14),
        [stylesMode.dark]: { color: 'warning.light' },
      })}
    >
      <Iconify icon="solar:danger-triangle-bold-duotone" width={28} />
    </Avatar>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="subtitle2" noWrap>
        {row.name}
      </Typography>
      <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary' }}>
        {row.reason === 'full' ? 'ตู้นี้มีประเภทนี้ครบ Par แล้ว' : 'ตู้นี้ไม่ได้ตั้ง Par ประเภทนี้'}
      </Typography>
    </Box>
    <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
      <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
        {formatCount(row.scanned)}
      </Typography>
      <Label color="warning">นอกแผน</Label>
    </Stack>
  </ButtonBase>
));

// ----------------------------------------------------------------------

// แถวกลุ่มผ้า (สแกนแบบอิสระ / รับคืน / ผ้าที่ถูกข้าม) — ไม่แสดงรายชิ้น มีปุ่ม "ดูแท็ก"
export const WardGroupRow = memo(
  ({ icon = 'solar:t-shirt-bold-duotone', color = 'primary', title, caption, count, onOpen }) => {
    const accent = color === 'default' ? 'grey.500' : `${color}.main`;
    return (
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={(theme) => ({
          p: 1.25,
          pl: 1.5,
          borderRadius: 1.5,
          bgcolor: 'background.paper',
          border: softBorder(theme),
          borderLeftWidth: 4,
          borderLeftColor: accent,
          animation: 'wardGroupIn 260ms ease-out',
          '@keyframes wardGroupIn': {
            from: { opacity: 0, transform: 'translateY(-4px)' },
            to: { opacity: 1, transform: 'none' },
          },
        })}
      >
        <Avatar
          variant="rounded"
          sx={(theme) => ({
            width: 44,
            height: 44,
            borderRadius: 1.5,
            color: accent,
            bgcolor:
              color === 'default'
                ? varAlpha(theme.vars.palette.grey['500Channel'], 0.12)
                : varAlpha(theme.vars.palette[color].mainChannel, 0.12),
          })}
        >
          <Iconify icon={icon} width={24} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {title}
          </Typography>
          {caption && (
            <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary' }}>
              {caption}
            </Typography>
          )}
        </Box>
        <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ flexShrink: 0 }}>
          <Typography variant="h5">{formatCount(count)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            ชิ้น
          </Typography>
        </Stack>
        {onOpen && (
          <Button
            size="small"
            color="inherit"
            variant="soft"
            onClick={onOpen}
            startIcon={<Iconify icon="solar:eye-bold-duotone" width={18} />}
            sx={{ flexShrink: 0, minHeight: 36 }}
          >
            ดูแท็ก
          </Button>
        )}
      </Stack>
    );
  }
);

// ----------------------------------------------------------------------

// กล่องดูรายแท็ก — ทั้งรายการ หรือเฉพาะกลุ่ม (ใหม่สุดอยู่บน) แตะแถว = โปรไฟล์ผ้า, ปุ่ม × = เอาออกจากรายการ
export function WardTagsDialog({
  open,
  title,
  epcs,
  results,
  kinds,
  onRemove,
  onOpenProfile,
  onClose,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const query = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const list = [...epcs].reverse();
    if (!query) return list;
    return list.filter((epc) => {
      const item = results[epc]?.item;
      return [epc, item?.categoryName, item?.locationName, STATUS_LABEL[item?.status]]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(query));
    });
  }, [epcs, results, query]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle sx={{ pb: 1 }}>
        {title}{' '}
        <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
          ({formatCount(epcs.length)} ชิ้น)
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {epcs.length > 8 && (
          <TextField
            fullWidth
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหา EPC / ประเภทผ้า / ตำแหน่ง / สถานะ"
            sx={{ mb: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
        )}

        {rows.length === 0 ? (
          <EmptyContent title="ไม่พบแท็ก" sx={{ py: 4 }} />
        ) : (
          <Stack spacing={1}>
            {rows.slice(0, MAX_DIALOG_ROWS).map((epc) => {
              const entry = results[epc];
              const item = entry?.state === 'found' ? entry.item : null;
              const kind = kinds[epc];
              const skip = SKIP_KIND_META[kind];
              return (
                <Stack
                  key={epc}
                  direction="row"
                  alignItems="center"
                  spacing={1.25}
                  sx={{ px: 1.25, py: 1, borderRadius: 1, bgcolor: 'background.neutral' }}
                >
                  <ButtonBase
                    disabled={!item}
                    onClick={() => onOpenProfile(epc)}
                    sx={{
                      flex: 1,
                      gap: 1.25,
                      minWidth: 0,
                      display: 'flex',
                      textAlign: 'left',
                      borderRadius: 1,
                      justifyContent: 'flex-start',
                    }}
                  >
                    <Iconify
                      icon={item ? 'solar:t-shirt-bold-duotone' : 'svg-spinners:180-ring'}
                      width={26}
                      sx={{
                        flexShrink: 0,
                        color: item
                          ? `${STATUS_COLOR[item.status] || 'primary'}.main`
                          : 'info.main',
                      }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                      >
                        {epc}
                      </Typography>
                      <Typography
                        variant="caption"
                        component="div"
                        noWrap
                        sx={{ color: 'text.secondary' }}
                      >
                        {item
                          ? [item.categoryName || 'ไม่ระบุประเภทผ้า', item.locationName]
                              .filter(Boolean)
                              .join(' · ')
                          : 'กำลังตรวจสอบกับระบบ…'}
                      </Typography>
                    </Box>
                  </ButtonBase>
                  <Stack
                    alignItems="flex-end"
                    spacing={0.5}
                    sx={{ flexShrink: 0, maxWidth: '40%' }}
                  >
                    {item && (
                      <Label color={STATUS_COLOR[item.status] || 'default'} sx={{ maxWidth: 1 }}>
                        <Box
                          component="span"
                          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5 }}
                        >
                          {STATUS_LABEL[item.status] ?? item.status}
                        </Box>
                      </Label>
                    )}
                    {skip && <Label color={skip.color}>{skip.title}</Label>}
                    {kind === 'transfer' && <Label color="secondary">ย้ายจากตู้อื่น</Label>}
                  </Stack>
                  <Tooltip title="เอาออกจากรายการ">
                    <IconButton size="small" onClick={() => onRemove(epc)} sx={{ flexShrink: 0 }}>
                      <Iconify icon="mingcute:close-line" width={18} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              );
            })}
            {rows.length > MAX_DIALOG_ROWS && (
              <Typography
                variant="caption"
                sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}
              >
                แสดง {MAX_DIALOG_ROWS} ชิ้นล่าสุด — ค้นหาเพื่อดูชิ้นอื่น
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose} sx={{ minHeight: 44 }}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}
