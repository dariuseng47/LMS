'use client';

import { memo, useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import CardContent from '@mui/material/CardContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import useMediaQuery from '@mui/material/useMediaQuery';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';

import { useAutoScan } from 'src/hooks/use-auto-scan';
import { useEpcLookup } from 'src/hooks/use-epc-lookup';
import { useFitViewport } from 'src/hooks/use-fit-viewport';

import { useGetDevices } from 'src/actions/devices';
import { scanCheckpoint } from 'src/actions/rfidReader';
import { varAlpha, bgGradient, stylesMode } from 'src/theme/styles';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { FabricItemProfileDialog } from 'src/sections/fabric/fabric-item-profile-dialog';
import {
  washUsage,
  STATUS_LABEL,
  STATUS_COLOR,
  FABRIC_STATUSES,
} from 'src/sections/fabric/fabric-constants';

import { SectionAvatar } from './restock-section-avatar';
import { NotFoundTagsButton } from './not-found-tags-button';

// ----------------------------------------------------------------------

// อ่านต่อเนื่องได้นานสุดเท่านี้แล้วหยุดเอง (แบบหน้ารับผ้าหลังซัก) กันลืมเปิดเครื่องอ่านทิ้งไว้
const MAX_CONTINUOUS_MS = 10 * 60 * 1000;
// แสดงรายชิ้นไม่เกินนี้ (สรุปด้านขวายังนับครบทุกชิ้น) กันหน้าหน่วงตอนสแกนรถเข็นผ้าทั้งคัน
const MAX_ROWS = 300;

const FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'found', label: 'ลงทะเบียนแล้ว' },
  { value: 'nearEnd', label: 'ใกล้ครบรอบซัก' },
];

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

const entryState = (entry) => entry?.state ?? 'pending';

const isNearEnd = (entry) =>
  entry?.state === 'found' &&
  washUsage(entry.item.washCount, entry.item.maxWashCycles)?.color === 'error';

function matchesSearch(epc, entry, query) {
  if (!query) return true;
  const item = entry?.item;
  return [epc, item?.categoryName, item?.locationName, STATUS_LABEL[item?.status]]
    .filter(Boolean)
    .some((text) => text.toLowerCase().includes(query));
}

// ----------------------------------------------------------------------

function RowIcon({ icon, color }) {
  return (
    <Avatar
      variant="rounded"
      sx={(theme) => ({
        width: 44,
        height: 44,
        borderRadius: 1.5,
        flexShrink: 0,
        color: `${color}.dark`,
        bgcolor: varAlpha(theme.vars.palette[color].mainChannel, 0.14),
        [stylesMode.dark]: { color: `${color}.light` },
      })}
    >
      <Iconify icon={icon} width={24} />
    </Avatar>
  );
}

// memo — รายการยาวหลักร้อย ผลตรวจเป็นก้อนกลับมาเปลี่ยนแค่บางแถว (entry แถวอื่นเป็น object เดิม)
const InspectTagRow = memo(({ epc, entry, onOpen, onRemove }) => {
  const state = entryState(entry);
  const item = entry?.item;
  const found = state === 'found';
  const usage = found ? washUsage(item.washCount, item.maxWashCycles) : null;
  const statusColor = found ? STATUS_COLOR[item.status] || 'primary' : null;

  let icon = 'svg-spinners:180-ring';
  let iconColor = 'info';
  if (found) {
    icon = 'solar:t-shirt-bold-duotone';
    iconColor = statusColor;
  } else if (state === 'error') {
    icon = 'solar:danger-triangle-bold-duotone';
    iconColor = 'error';
  }

  const removeButton = (
    <Tooltip title="เอาออกจากรายการ">
      <IconButton
        size="small"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(epc);
        }}
        sx={{ color: 'text.disabled', flexShrink: 0 }}
      >
        <Iconify icon="mingcute:close-line" width={16} />
      </IconButton>
    </Tooltip>
  );

  return (
    <ButtonBase
      component="div"
      disabled={!found}
      onClick={found ? () => onOpen(epc) : undefined}
      sx={(theme) => ({
        p: 1.5,
        gap: 1.5,
        width: 1,
        display: 'flex',
        textAlign: 'left',
        alignItems: 'center',
        borderRadius: 1.5,
        position: 'relative',
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
        transition: theme.transitions.create(['box-shadow', 'transform', 'border-color']),
        animation: 'inspectRowIn 280ms ease-out',
        '@keyframes inspectRowIn': {
          from: { opacity: 0, transform: 'translateY(-6px)' },
          to: { opacity: 1, transform: 'none' },
        },
        '&.Mui-disabled': { pointerEvents: 'auto', cursor: 'default' },
        ...(found && {
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 10,
            bottom: 10,
            width: 4,
            borderRadius: '0 4px 4px 0',
            bgcolor: `${statusColor}.main`,
          },
          '&:hover': {
            borderColor: 'transparent',
            boxShadow: theme.customShadows?.z8,
            transform: 'translateY(-1px)',
          },
        }),
        ...(state === 'error' && {
          borderColor: varAlpha(theme.vars.palette.error.mainChannel, 0.32),
        }),
      })}
    >
      <RowIcon icon={icon} color={iconColor} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {state === 'pending' ? (
          <Skeleton width="55%" height={22} />
        ) : (
          <Typography variant="subtitle2" noWrap>
            {found && (item.categoryName || 'ไม่ระบุประเภทผ้า')}
            {state === 'error' && 'ตรวจสอบไม่สำเร็จ'}
          </Typography>
        )}
        <Typography
          variant="caption"
          component="div"
          noWrap
          sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
        >
          {epc}
        </Typography>
        {found && (
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ mt: 0.25, color: 'text.secondary', minWidth: 0 }}
          >
            <Iconify icon="solar:map-point-bold-duotone" width={14} sx={{ flexShrink: 0 }} />
            <Typography variant="caption" noWrap>
              {item.locationName || 'ไม่ทราบตำแหน่งปัจจุบัน'}
            </Typography>
          </Stack>
        )}
      </Box>

      {found && (
        <Stack alignItems="flex-end" spacing={0.75} sx={{ flexShrink: 0, maxWidth: '42%' }}>
          <Label color={statusColor} sx={{ maxWidth: 1 }}>
            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {STATUS_LABEL[item.status] ?? item.status}
            </Box>
          </Label>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Iconify
              icon="solar:washing-machine-bold-duotone"
              width={16}
              sx={{ color: usage ? `${usage.color}.main` : 'text.disabled' }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
              ซัก {item.washCount ?? 0}
              {item.maxWashCycles ? `/${item.maxWashCycles}` : ' ครั้ง'}
            </Typography>
          </Stack>
          {usage && (
            <LinearProgress
              variant="determinate"
              value={usage.percent}
              color={usage.color}
              sx={{ width: 72, height: 4, borderRadius: 1 }}
            />
          )}
        </Stack>
      )}

      {found ? (
        <Iconify icon="eva:arrow-ios-forward-fill" width={18} sx={{ color: 'text.disabled' }} />
      ) : (
        removeButton
      )}
    </ButtonBase>
  );
});

// ----------------------------------------------------------------------

function SummaryRow({ color, label, count, total, active, onClick }) {
  const percent = total ? Math.round((count / total) * 100) : 0;
  return (
    <ButtonBase
      onClick={onClick}
      sx={(theme) => ({
        px: 1.25,
        py: 1,
        width: 1,
        display: 'block',
        textAlign: 'left',
        borderRadius: 1,
        transition: theme.transitions.create('background-color'),
        '&:hover': { bgcolor: 'action.hover' },
        ...(active && { bgcolor: varAlpha(theme.vars.palette[color].mainChannel, 0.12) }),
      })}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: `${color}.main`,
            flexShrink: 0,
          }}
        />
        <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: active ? 700 : 500 }}>
          {label}
        </Typography>
        <Typography variant="subtitle2">{count.toLocaleString('th-TH')}</Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.disabled', width: 36, textAlign: 'right' }}
        >
          {percent}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        color={color}
        sx={{ mt: 0.75, height: 4, borderRadius: 1, bgcolor: 'background.neutral' }}
      />
    </ButtonBase>
  );
}

// ----------------------------------------------------------------------

export function InspectScanCard({ hospitalId }) {
  const theme = useTheme();
  const { devices } = useGetDevices(hospitalId, 'RFID_CHECKPOINT');

  const [deviceId, setDeviceId] = useState('');
  const [scanning, setScanning] = useState(false);

  // เลือกเครื่องที่ตั้งเป็น default ของจุด "สแกนตรวจสอบผ้า" -> ถ้าไม่มี ใช้ของจุดสแกนเข้าสต๊อค -> เครื่องแรก
  useEffect(() => {
    if (deviceId || devices.length === 0) return;
    const byPoint = (point) => devices.find((d) => (d.default_scan_points ?? []).includes(point));
    const preset = byPoint('INSPECT_SCAN') || byPoint('STOCK_SCAN') || devices[0];
    setDeviceId(preset.id);
  }, [devices, deviceId]);

  // รายการ EPC ที่สแกนได้ ล่าสุดอยู่บน — seenRef กันซ้ำแบบ sync (แท็กไหลเข้าเร็วกว่า state อัปเดต)
  const [epcs, setEpcs] = useState([]);
  const seenRef = useRef(new Set());
  const [lastAdded, setLastAdded] = useState([]);

  const addEpcs = useCallback((codes) => {
    const fresh = [];
    codes.forEach((raw) => {
      const code = typeof raw === 'string' ? raw.trim() : raw?.epc?.trim();
      if (!code || seenRef.current.has(code)) return;
      seenRef.current.add(code);
      fresh.push(code);
    });
    if (fresh.length) {
      setEpcs((prev) => [...[...fresh].reverse(), ...prev]);
      setLastAdded(fresh);
    }
    return fresh.length;
  }, []);

  const removeEpc = useCallback((code) => {
    seenRef.current.delete(code);
    setEpcs((prev) => prev.filter((c) => c !== code));
  }, []);

  const lookup = useEpcLookup(epcs, hospitalId);
  // แท็กที่ไม่พบในระบบไม่แสดงในรายการ/ไม่นับเป็นผ้าที่พบ — ดูผ่านปุ่ม "ไม่พบในระบบ"
  const { listedEpcs, notFoundEpcs } = lookup;
  const lastAddedCount = useMemo(
    () => lastAdded.filter((code) => lookup.results[code]?.state !== 'notFound').length,
    [lastAdded, lookup.results]
  );

  // ---------- อ่านครั้งเดียว ----------
  const handleScanOnce = useCallback(async () => {
    if (!deviceId) {
      toast.error('เลือกเครื่องอ่าน RFID ก่อน');
      return;
    }
    setScanning(true);
    try {
      const { epcs: tags } = await scanCheckpoint(Number(deviceId), hospitalId);
      if (tags.length === 0) toast.error('ไม่พบแท็กในระยะสัญญาณ');
      else {
        const added = addEpcs(tags);
        toast.success(
          added ? `อ่านแท็กใหม่ได้ ${added} รายการ` : 'แท็กที่อ่านได้อยู่ในรายการแล้วทั้งหมด'
        );
      }
    } catch (error) {
      toast.error(
        error?.message || 'สแกนไม่สำเร็จ — ตรวจสอบว่าเครื่องอ่านเปิดอยู่และเชื่อมเครือข่ายได้'
      );
    } finally {
      setScanning(false);
    }
  }, [deviceId, hospitalId, addEpcs]);

  // ---------- อ่านต่อเนื่อง ----------
  const handleContinuousTags = useCallback((tags) => addEpcs(tags), [addEpcs]);
  const {
    running: continuous,
    start: startContinuous,
    stop: stopContinuous,
  } = useAutoScan({ hospitalId, onTags: handleContinuousTags, maxErrors: 3 });

  const [continuousSec, setContinuousSec] = useState(0);
  useEffect(() => {
    if (!continuous) return undefined;
    const startedAt = Date.now();
    setContinuousSec(0);
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setContinuousSec(Math.floor(elapsed / 1000));
      if (elapsed >= MAX_CONTINUOUS_MS) {
        stopContinuous();
        toast.info('หยุดอ่านต่อเนื่องอัตโนมัติ (ครบ 10 นาที)');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [continuous, stopContinuous]);

  const handleToggleContinuous = useCallback(() => {
    if (continuous) {
      stopContinuous();
      return;
    }
    if (!deviceId) {
      toast.error('เลือกเครื่องอ่าน RFID ก่อน');
      return;
    }
    startContinuous(Number(deviceId));
  }, [continuous, deviceId, startContinuous, stopContinuous]);

  // ---------- กรอก EPC เอง ----------
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const handleManualAdd = () => {
    const codes = parseEpcCodes(manualText);
    const added = addEpcs(codes);
    toast.success(added ? `เพิ่มเข้ารายการ ${added} รายการ` : 'รหัสที่กรอกอยู่ในรายการแล้วทั้งหมด');
    setManualText('');
    setManualOpen(false);
  };

  const handleClear = useCallback(() => {
    seenRef.current = new Set();
    setEpcs([]);
    setLastAdded([]);
  }, []);

  // ---------- กรอง / ค้นหา ----------
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(null);
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const summary = useMemo(() => {
    const byStatus = {};
    const byCategory = new Map();
    let nearEnd = 0;
    epcs.forEach((code) => {
      const entry = lookup.results[code];
      if (entry?.state !== 'found') return;
      const { status, categoryName } = entry.item;
      byStatus[status] = (byStatus[status] || 0) + 1;
      const name = categoryName || 'ไม่ระบุประเภทผ้า';
      byCategory.set(name, (byCategory.get(name) || 0) + 1);
      if (isNearEnd(entry)) nearEnd += 1;
    });
    const categories = [...byCategory.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));
    return { byStatus, categories, nearEnd };
  }, [epcs, lookup.results]);

  const filteredEpcs = useMemo(
    () =>
      listedEpcs.filter((code) => {
        const entry = lookup.results[code];
        const state = entryState(entry);
        if (filter === 'found' && state !== 'found') return false;
        if (filter === 'nearEnd' && !isNearEnd(entry)) return false;
        if (statusFilter && !(state === 'found' && entry.item.status === statusFilter))
          return false;
        return matchesSearch(code, entry, query);
      }),
    [listedEpcs, lookup.results, filter, statusFilter, query]
  );
  const visibleEpcs = filteredEpcs.slice(0, MAX_ROWS);

  const filterCount = {
    all: listedEpcs.length,
    found: lookup.foundCount,
    nearEnd: summary.nearEnd,
  };

  // ---------- โปรไฟล์ผ้า ----------
  // เก็บ epc ไว้แม้ปิด dialog แล้ว — ระหว่างแอนิเมชันปิด เนื้อหาเดิมยังอยู่ ไม่กระพริบเป็น "ไม่พบข้อมูล"
  const [profile, setProfile] = useState({ epc: null, open: false });
  const openProfile = useCallback((code) => setProfile({ epc: code, open: true }), []);

  const { recheck } = lookup;
  const handleRefreshAll = () => {
    const found = epcs.filter((code) => lookup.results[code]?.state !== 'error');
    recheck(found);
    if (lookup.failedCount) lookup.retryFailed();
    toast.info('กำลังโหลดสถานะล่าสุดของผ้าทั้งหมด…');
  };

  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { ref: fitRef, height: fitHeight } = useFitViewport({ enabled: isDesktop });
  const fit = fitHeight !== null;

  const checkedPercent = epcs.length ? Math.round((lookup.checkedCount / epcs.length) * 100) : 0;

  // ---------- ส่วนแสดงผล ----------
  const renderScanControls = (
    <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
      <Button
        type="button"
        size="large"
        variant="contained"
        color={continuous ? 'error' : 'primary'}
        disabled={!deviceId || scanning}
        onClick={handleToggleContinuous}
        startIcon={
          <Iconify
            icon={continuous ? 'solar:stop-circle-bold' : 'solar:radar-2-bold-duotone'}
            width={28}
          />
        }
        sx={{
          flex: 1,
          py: fit ? 1.25 : 2,
          fontSize: 20,
          fontWeight: 700,
          minHeight: fit ? 60 : 68,
          ...(continuous && {
            animation: 'inspectPulse 1.6s ease-in-out infinite',
            '@keyframes inspectPulse': {
              '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 86, 48, 0.45)' },
              '50%': { boxShadow: '0 0 0 10px rgba(255, 86, 48, 0)' },
            },
          }),
        }}
      >
        {continuous
          ? `หยุดอ่าน · ${Math.floor(continuousSec / 60)}:${String(continuousSec % 60).padStart(2, '0')}`
          : 'เริ่มอ่านต่อเนื่อง'}
      </Button>
      <LoadingButton
        type="button"
        size="large"
        variant="outlined"
        loading={scanning}
        disabled={!deviceId || continuous}
        onClick={handleScanOnce}
        sx={{ flexShrink: 0, minHeight: fit ? 60 : 68, px: 2.5, fontWeight: 700, fontSize: 16 }}
      >
        อ่านครั้งเดียว
      </LoadingButton>
      <Tooltip title="กรอกรหัส EPC เอง (วางได้หลายรายการ)">
        <Button
          type="button"
          variant="outlined"
          color="inherit"
          onClick={() => setManualOpen(true)}
          sx={{ flexShrink: 0, minWidth: 0, px: 2, minHeight: fit ? 60 : 68 }}
        >
          <Iconify icon="solar:keyboard-bold-duotone" width={26} />
        </Button>
      </Tooltip>
    </Stack>
  );

  const renderToolbar = (
    <Stack spacing={1.25} sx={{ flexShrink: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          size="small"
          fullWidth
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหา EPC / ประเภทผ้า / ตำแหน่ง / สถานะ"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}>
                  <Iconify icon="mingcute:close-line" width={16} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <Button
          color="error"
          variant="outlined"
          disabled={epcs.length === 0}
          onClick={handleClear}
          startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
          sx={{ flexShrink: 0, minHeight: 40, px: 2, fontWeight: 700 }}
        >
          ล้าง
        </Button>
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          if (f.value === 'nearEnd' && !filterCount.nearEnd && !active) return null;
          return (
            <Chip
              key={f.value}
              clickable
              size="small"
              color={active ? (f.value === 'nearEnd' ? 'warning' : 'primary') : 'default'}
              variant={active ? 'filled' : 'soft'}
              onClick={() => setFilter(f.value)}
              label={`${f.label} ${filterCount[f.value].toLocaleString('th-TH')}`}
            />
          );
        })}
        {notFoundEpcs.length > 0 && <NotFoundTagsButton epcs={notFoundEpcs} onRemove={removeEpc} />}
        {statusFilter && (
          <Chip
            size="small"
            color={STATUS_COLOR[statusFilter] || 'default'}
            variant="filled"
            onDelete={() => setStatusFilter(null)}
            label={`สถานะ: ${STATUS_LABEL[statusFilter] ?? statusFilter}`}
          />
        )}
        {lookup.failedCount > 0 && (
          <Chip
            size="small"
            color="warning"
            onClick={lookup.retryFailed}
            icon={<Iconify icon="solar:restart-bold" />}
            label={`ตรวจไม่สำเร็จ ${lookup.failedCount} — แตะเพื่อลองใหม่`}
          />
        )}
      </Stack>
    </Stack>
  );

  let listContent;
  if (listedEpcs.length === 0) {
    listContent = (
      <EmptyContent
        title={notFoundEpcs.length > 0 ? 'ยังไม่พบผ้าที่ลงทะเบียน' : 'ยังไม่มีผ้าในรายการ'}
        description="กด “เริ่มอ่านต่อเนื่อง” แล้วนำผ้าผ่านเครื่องอ่าน — หรือกดปุ่มคีย์บอร์ดเพื่อกรอกรหัส EPC เอง"
        sx={{ py: 3, height: 1, bgcolor: 'transparent' }}
        slotProps={{ img: { maxWidth: fit ? 110 : 160 } }}
      />
    );
  } else if (filteredEpcs.length === 0) {
    listContent = (
      <EmptyContent
        title="ไม่พบผ้าที่ตรงกับตัวกรอง"
        description="ลองล้างคำค้นหา หรือเลือกตัวกรอง “ทั้งหมด”"
        sx={{ py: 3, height: 1, bgcolor: 'transparent' }}
        slotProps={{ img: { maxWidth: 96 } }}
      />
    );
  } else {
    listContent = (
      <Box sx={{ p: 1.5 }}>
        <Box
          sx={{
            display: 'grid',
            gap: 1.25,
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {visibleEpcs.map((code) => (
            <InspectTagRow
              key={code}
              epc={code}
              entry={lookup.results[code]}
              onOpen={openProfile}
              onRemove={removeEpc}
            />
          ))}
        </Box>
        {filteredEpcs.length > MAX_ROWS && (
          <Typography
            variant="caption"
            component="div"
            sx={{ mt: 1.5, textAlign: 'center', color: 'text.secondary' }}
          >
            แสดง {MAX_ROWS} รายการล่าสุด — อีก {filteredEpcs.length - MAX_ROWS} ชิ้นนับรวมในสรุปแล้ว
            (ใช้ค้นหา/ตัวกรองเพื่อดูเฉพาะชิ้น)
          </Typography>
        )}
      </Box>
    );
  }

  const renderHero = (
    <Card
      sx={{
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        color: 'common.white',
        ...bgGradient({
          color: `135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.primary.darker} 100%`,
        }),
      }}
    >
      <Iconify
        icon="solar:shield-check-bold-duotone"
        width={150}
        sx={{ position: 'absolute', right: -28, bottom: -34, opacity: 0.14 }}
      />
      <CardContent sx={{ position: 'relative', ...(fit && { py: '16px !important' }) }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography sx={{ opacity: 0.88, fontWeight: 700, fontSize: 14 }}>
            ผ้าที่สแกนพบ
          </Typography>
          {continuous && (
            <Label
              variant="filled"
              color="error"
              startIcon={<Iconify icon="svg-spinners:pulse-2" />}
            >
              กำลังอ่าน
            </Label>
          )}
        </Stack>
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <Typography
            sx={{
              fontWeight: 800,
              lineHeight: 1.05,
              fontSize: fit ? 'clamp(48px, 9vh, 80px)' : 80,
            }}
          >
            {listedEpcs.length.toLocaleString('th-TH')}
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.88 }}>
            ชิ้น
          </Typography>
          {lastAddedCount > 0 && listedEpcs.length > 0 && (
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              (+{lastAddedCount} ล่าสุด)
            </Typography>
          )}
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mt: 1, typography: 'body2' }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Iconify icon="solar:check-circle-bold" width={16} />
            <span>ลงทะเบียนแล้ว {lookup.foundCount}</span>
          </Stack>
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ opacity: lookup.notFoundCount ? 1 : 0.7 }}
          >
            <Iconify icon="solar:question-circle-bold" width={16} />
            <span>ไม่พบในระบบ {lookup.notFoundCount}</span>
          </Stack>
        </Stack>

        <Box sx={{ mt: 1.5 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ typography: 'caption', opacity: 0.85, mb: 0.5 }}
          >
            <span>
              {lookup.pendingCount > 0
                ? `กำลังตรวจสอบกับระบบ… เหลือ ${lookup.pendingCount}`
                : 'ตรวจสอบกับระบบครบแล้ว'}
            </span>
            <span>
              {lookup.checkedCount}/{epcs.length}
            </span>
          </Stack>
          <LinearProgress
            variant={
              lookup.pendingCount > 0 && lookup.checkedCount === 0 ? 'indeterminate' : 'determinate'
            }
            value={checkedPercent}
            sx={{
              height: 6,
              borderRadius: 1,
              bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.24),
              '& .MuiLinearProgress-bar': { bgcolor: 'common.white' },
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );

  const statusRows = FABRIC_STATUSES.filter((s) => summary.byStatus[s]);

  const renderStatusSummary = (
    <Card sx={{ flexShrink: 0 }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          แยกตามสถานะ
        </Typography>
        <Tooltip title="โหลดสถานะ/ตำแหน่งล่าสุดใหม่ทั้งหมด">
          <span>
            <IconButton size="small" disabled={epcs.length === 0} onClick={handleRefreshAll}>
              <Iconify icon="solar:refresh-bold-duotone" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Box sx={{ px: 1, pb: 1.5 }}>
        {statusRows.length === 0 ? (
          <Typography variant="body2" sx={{ px: 1.25, pb: 0.5, color: 'text.disabled' }}>
            ยังไม่มีข้อมูล
          </Typography>
        ) : (
          statusRows.map((s) => (
            <SummaryRow
              key={s}
              color={STATUS_COLOR[s] || 'primary'}
              label={STATUS_LABEL[s]}
              count={summary.byStatus[s]}
              total={lookup.foundCount}
              active={statusFilter === s}
              onClick={() => setStatusFilter((prev) => (prev === s ? null : s))}
            />
          ))
        )}
      </Box>
    </Card>
  );

  const renderCategorySummary = (
    <Card
      sx={{
        display: 'flex',
        flexDirection: 'column',
        ...(fit ? { flex: 1, minHeight: 0 } : {}),
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          แยกตามประเภทผ้า
        </Typography>
        {summary.categories.length > 0 && (
          <Label color="default">{summary.categories.length} ประเภท</Label>
        )}
      </Stack>
      <Box
        sx={{
          px: 2,
          pb: 2,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          ...(fit && { flex: 1 }),
        }}
      >
        {summary.categories.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            ยังไม่มีข้อมูล
          </Typography>
        ) : (
          <Stack spacing={0.25}>
            {summary.categories.map((row, index) => (
              <Stack
                key={row.name}
                direction="row"
                alignItems="center"
                spacing={1.25}
                onClick={() => setSearch(row.name)}
                sx={{
                  py: 0.75,
                  cursor: 'pointer',
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'primary.dark',
                    bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.12),
                  }}
                >
                  {index + 1}
                </Avatar>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                  {row.name}
                </Typography>
                <Typography variant="subtitle2">
                  {row.count.toLocaleString('th-TH')} ชิ้น
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>
    </Card>
  );

  return (
    <>
      <Grid
        ref={fitRef}
        container
        spacing={fit ? 2 : 3}
        alignItems="stretch"
        sx={{
          touchAction: 'manipulation',
          ...(fit && { height: fitHeight, overflow: 'hidden' }),
        }}
      >
        <Grid item xs={12} md={8} sx={fit ? { height: 1 } : undefined}>
          <Card sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              spacing={2}
              sx={{ px: 3, pt: fit ? 2 : 3, flexShrink: 0 }}
            >
              <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                <SectionAvatar icon="solar:shield-check-bold-duotone" color="primary" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6">สแกนตรวจสอบผ้า</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                    อ่านอย่างเดียว ไม่บันทึกลงระบบ — แตะผ้าเพื่อดูโปรไฟล์ ประวัติซัก รอบซัก
                  </Typography>
                </Box>
              </Stack>
              {devices.length > 0 && (
                <TextField
                  select
                  size="small"
                  label="เครื่องอ่าน"
                  value={deviceId}
                  disabled={continuous}
                  onChange={(event) => setDeviceId(event.target.value)}
                  sx={{ minWidth: 180, maxWidth: { sm: 240 } }}
                >
                  {devices.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {`#${d.id} ${d.ip_address ? `(${d.ip_address}:${d.port})` : ''}`}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>

            <CardContent
              sx={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: fit ? 1.5 : 2,
                ...(fit && { pt: 2, pb: '16px !important' }),
              }}
            >
              {devices.length === 0 && (
                <Alert
                  severity="warning"
                  icon={<Iconify icon="solar:danger-triangle-bold-duotone" />}
                  sx={{ flexShrink: 0 }}
                >
                  ยังไม่มีเครื่องอ่าน RFID ประเภท &ldquo;จุดตรวจสอบ&rdquo; ที่ผูกกับโรงพยาบาลนี้ —
                  เพิ่มได้ในหน้า &ldquo;อุปกรณ์ & สัญญาณ RFID&rdquo;
                  หรือกดปุ่มคีย์บอร์ดเพื่อกรอกรหัส EPC เองไปก่อน
                </Alert>
              )}

              {renderScanControls}
              {renderToolbar}

              <Box
                sx={{
                  ...(fit ? { flex: 1, minHeight: 120 } : { height: 480 }),
                  borderRadius: 1.5,
                  bgcolor: 'background.neutral',
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                }}
              >
                {listContent}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4} sx={fit ? { height: 1 } : undefined}>
          <Stack spacing={fit ? 2 : 3} sx={{ height: 1, minHeight: 0 }}>
            {renderHero}
            {renderStatusSummary}
            {renderCategorySummary}
          </Stack>
        </Grid>
      </Grid>

      <Dialog open={manualOpen} onClose={() => setManualOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>กรอกรหัส EPC</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            วางได้หลายรายการ คั่นด้วยการขึ้นบรรทัดใหม่ เว้นวรรค หรือจุลภาค
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={5}
            value={manualText}
            onChange={(event) => setManualText(event.target.value)}
            placeholder={'เช่น\nE2801160600002...\nE2801160600003...'}
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setManualOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="contained" disabled={!manualText.trim()} onClick={handleManualAdd}>
            ตรวจสอบ ({parseEpcCodes(manualText).length})
          </Button>
        </DialogActions>
      </Dialog>

      <FabricItemProfileDialog
        epc={profile.epc}
        hospitalId={hospitalId}
        open={profile.open}
        onClose={() => setProfile((prev) => ({ ...prev, open: false }))}
        onChanged={(code) => recheck([code])}
      />
    </>
  );
}
