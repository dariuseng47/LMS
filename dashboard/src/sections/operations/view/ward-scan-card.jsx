'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import { useTheme } from '@mui/material/styles';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import CardContent from '@mui/material/CardContent';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import useMediaQuery from '@mui/material/useMediaQuery';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useBoolean } from 'src/hooks/use-boolean';
import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useFitViewport } from 'src/hooks/use-fit-viewport';
import { usePermission } from 'src/hooks/use-has-permission';
import { getStorage, setStorage } from 'src/hooks/use-local-storage';

import { varAlpha, bgGradient } from 'src/theme/styles';
import { useGetRestockCartPlan } from 'src/actions/restockCartPlan';
import { wardIssueBatch, wardReceiveBatch } from 'src/actions/scans';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { deviceName, deviceDetail } from 'src/sections/devices/device-constants';
import { FabricItemProfileDialog } from 'src/sections/fabric/fabric-item-profile-dialog';
// ปุ่มอ่านครั้งเดียว/อ่านต่อเนื่อง + กล่องกรอกรหัส ใช้ตัวเดียวกับหน้าเปลี่ยนประเภทผ้า (ไม่ผูกกับการเปลี่ยนประเภท)
import { useChangeCategoryScan } from 'src/sections/fabric/view/use-change-category-scan';
import { ChangeCategoryManualDialog } from 'src/sections/fabric/view/change-category-manual-dialog';

import { SectionAvatar } from './restock-section-avatar';
import { ReaderNotSelectedAlert } from './scan-reader-tab';
import { NotFoundTagsButton } from './not-found-tags-button';
import { useWardScanList, buildPlanProgress } from './use-ward-scan-list';
import { cabinetPlanState, WardCabinetPickerDialog } from './ward-cabinet-picker-dialog';
import { WardPlanCard, WardGroupRow, WardExtraCard, WardTagsDialog } from './ward-scan-groups';

// ----------------------------------------------------------------------

// เพดานต่อครั้งของ POST /scans/ward-issue-batch, /ward-receive-batch
const MAX_PER_BATCH = 500;
// จำว่าเช็ค "อ้างอิงจากแท็บจัดผ้าเข้ารถ" ไว้หรือไม่ (ต่อเบราว์เซอร์)
const PLAN_PREF_KEY = 'ward-scan:use-plan';

const MODES = {
  issue: {
    value: 'issue',
    label: 'จ่ายผ้าไปวอร์ด',
    title: 'สแกนจ่ายผ้าไปวอร์ด',
    heroLabel: 'จำนวนที่จะจ่ายเข้าตู้',
    icon: 'solar:delivery-bold-duotone',
    color: 'primary',
  },
  receive: {
    value: 'receive',
    label: 'รับผ้าคืน',
    title: 'สแกนรับผ้าคืนจากวอร์ด',
    heroLabel: 'จำนวนที่จะรับคืน',
    icon: 'solar:inbox-in-bold-duotone',
    color: 'info',
  },
};

const formatCount = (n) => n.toLocaleString('th-TH');

// รหัสผ้าใน payload ของ socket event สแกนต่าง ๆ (ทีละชิ้น: epcCode, ทั้งชุด: epcCodes, รับผ้าหลังซัก/เข้าสต๊อค: processed)
const epcCodesOf = (payload) => [
  ...(payload?.epcCodes ?? []),
  ...(payload?.epcCode ? [payload.epcCode] : []),
  ...(payload?.processed ?? []).map((p) => p.epcCode).filter(Boolean),
];

// ----------------------------------------------------------------------

/**
 * แท็บ "สแกนรับ-ส่งผ้า" — สแกนผ้าผ่านเครื่องอ่าน RFID แบบหน้าสแกนตรวจสอบผ้า (อ่านต่อเนื่อง / อ่านครั้งเดียว / กรอกรหัส)
 * แล้วยืนยันจ่ายเข้าตู้ หรือรับคืนทีเดียวทั้งชุด
 *
 * จ่ายผ้า + เช็ค "เพิ่มผ้าโดยอ้างอิงจากแท็บจัดผ้าเข้ารถ" = การ์ดรายประเภทตามแผนของตู้ปลายทาง (ต้องเติมกี่ชิ้น)
 *   สแกนครบหรือเกินจำนวน = การ์ดเป็นสีเขียว "ครบแล้ว"
 * ไม่เช็ค / รับคืน = สแกนแบบอิสระ แสดงเป็นกลุ่มจำนวนแยกตามประเภทผ้า (ไม่แสดงรายชิ้น — ดูผ่านปุ่ม "ดูแท็ก")
 *
 * reader = ผลจาก useScanReader | active = แท็บนี้เปิดอยู่ (สลับแท็บแล้วการ์ดแค่ถูกซ่อน รายการไม่หาย)
 * request = { cabinetId, at } จากปุ่ม "สแกนจ่ายผ้าเข้าตู้นี้" ในแท็บจัดผ้าเข้ารถ
 */
export function WardScanCard({ hospitalId, reader, active, request, onOpenReader }) {
  const theme = useTheme();
  const { devices, devicesLoading, deviceId } = reader;
  const device = devices.find((d) => d.id === deviceId);

  const { can, ready: permissionsReady } = usePermission();
  // รอโหลดสิทธิ์ = ยังไม่ล็อก (server เช็คซ้ำตอนบันทึกอยู่แล้ว) กันปุ่มกระพริบเป็นไม่มีสิทธิ์ตอนเปิดหน้า
  const canEdit = !permissionsReady || can('web.operations.ward.edit');

  const [mode, setMode] = useState('issue');
  const modeMeta = MODES[mode];
  const [cabinetId, setCabinetId] = useState(null);
  const [usePlan, setUsePlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [tagView, setTagView] = useState(null); // { title, select }
  const [profile, setProfile] = useState({ epc: null, open: false });

  const picker = useBoolean();
  const manualDialog = useBoolean();
  const incompleteDialog = useBoolean();

  useEffect(() => {
    setUsePlan(getStorage(PLAN_PREF_KEY) === true);
  }, []);
  const changeUsePlan = useCallback((checked) => {
    setUsePlan(checked);
    setStorage(PLAN_PREF_KEY, checked);
  }, []);

  const {
    cabinets: planCabinets,
    cartPlanLoading,
    refreshCartPlan,
  } = useGetRestockCartPlan(hospitalId);
  const cabinet = planCabinets.find((c) => c.cabinetId === cabinetId) ?? null;

  // ตู้ที่เลือกไว้ถูกลบไปแล้ว -> ให้เลือกใหม่
  useEffect(() => {
    if (!cartPlanLoading && cabinetId && planCabinets.length > 0 && !cabinet) setCabinetId(null);
  }, [cartPlanLoading, cabinetId, planCabinets.length, cabinet]);

  // มาจากปุ่ม "สแกนจ่ายผ้าเข้าตู้นี้" ในแท็บจัดผ้าเข้ารถ
  useEffect(() => {
    if (!request) return;
    setMode('issue');
    setCabinetId(request.cabinetId);
    changeUsePlan(true);
  }, [request, changeUsePlan]);

  const list = useWardScanList({ hospitalId, mode, cabinetId });
  const { lookup } = list;
  const { notFoundEpcs, recheck } = lookup;
  const validCount = list.validEpcs.length;

  const { scanning, scanOnce, continuous, continuousSec, toggleContinuous, stopContinuous } =
    useChangeCategoryScan({ hospitalId, deviceId, active, onEpcs: list.addTags });

  const planMode = mode === 'issue' && usePlan;
  const plan = useMemo(
    () => buildPlanProgress(cabinet?.lines, list.categoryGroups),
    [cabinet, list.categoryGroups]
  );
  const missingTargets = plan.targets.filter((t) => !t.done);

  // ผ้าถูกจ่าย/รับคืน/ซัก/เข้าสต๊อคจากที่อื่น -> แผนตู้เปลี่ยน + สถานะผ้าในรายการอาจไม่ตรงแล้ว
  const handleScanEvent = (payload) => {
    refreshCartPlan();
    recheck(epcCodesOf(payload));
  };
  useSocketEvent('scan:ward-issue', handleScanEvent);
  useSocketEvent('scan:ward-receive', handleScanEvent);
  useSocketEvent('scan:stock-scan', handleScanEvent);
  useSocketEvent('scan:wash-receive', handleScanEvent);
  useSocketEvent('scan:cabinet-audit', () => refreshCartPlan());
  useSocketEvent('scan:status-change', () => {
    refreshCartPlan();
    recheck(list.tagEpcs);
  });

  const handleAddCodes = (codes) => {
    const added = list.addTags(codes);
    if (added > 0) toast.success(`เพิ่มเข้ารายการ ${formatCount(added)} ชิ้น`);
    else toast.info('รหัสทั้งหมดอยู่ในรายการแล้ว');
  };

  const openTags = useCallback((select, title) => setTagView({ select, title }), []);
  const openPlanTags = useCallback(
    (row) => setTagView({ select: `cat:${row.categoryId}`, title: row.name }),
    []
  );

  const tagViewEpcs = useMemo(() => {
    if (!tagView) return [];
    const { select } = tagView;
    if (select === 'all') return lookup.listedEpcs;
    if (select === 'pending') return list.pendingEpcs;
    if (select === 'error') return list.errorEpcs;
    if (select.startsWith('cat:')) {
      return list.categoryGroups.find((g) => `cat:${g.categoryId}` === select)?.epcs ?? [];
    }
    return list.skipGroups.find((g) => `skip:${g.kind}` === select)?.epcs ?? [];
  }, [tagView, lookup.listedEpcs, list]);

  // ---------- บันทึก ----------
  const save = async () => {
    const epcCodes = list.validEpcs;
    setSaving(true);
    try {
      const result =
        mode === 'issue'
          ? await wardIssueBatch({ cabinetId, epcCodes })
          : await wardReceiveBatch({ epcCodes }, hospitalId);
      const saved = new Set(result.processed.map((p) => p.epcCode));
      const breakdown = list.categoryGroups
        .map((g) => ({ name: g.name, count: g.epcs.filter((epc) => saved.has(epc)).length }))
        .filter((row) => row.count > 0);
      const cabinetName = result.cabinetName ?? cabinet?.cabinetName;

      const skippedText = result.skipped.length
        ? ` (ข้าม ${formatCount(result.skipped.length)} ชิ้น)`
        : '';
      toast.success(
        mode === 'issue'
          ? `จ่ายผ้าเข้า ${cabinetName} สำเร็จ ${formatCount(saved.size)} ชิ้น${skippedText}`
          : `รับผ้าคืนสำเร็จ ${formatCount(saved.size)} ชิ้น${skippedText}`
      );
      setLastResult({
        mode,
        cabinetName,
        count: saved.size,
        skipped: result.skipped.length,
        breakdown,
        at: new Date(),
      });
      incompleteDialog.onFalse();
      list.clear();
      refreshCartPlan();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = () => {
    stopContinuous(); // หยุดอ่านก่อนบันทึก กันแท็กไหลเข้ามาหลังยืนยันชุดนี้ไปแล้ว
    if (planMode && missingTargets.length > 0) {
      incompleteDialog.onTrue();
      return;
    }
    save();
  };

  // ปุ่มหลักพาไปขั้นที่ยังขาดเอง — กดปุ่มเดียวไปเรื่อย ๆ ได้โดยไม่ต้องหาว่าติดอะไร
  let action;
  if (!canEdit) {
    action = { label: 'บัญชีนี้ไม่มีสิทธิ์บันทึกรับ-ส่งผ้า' };
  } else if (mode === 'issue' && !cabinet) {
    action = { label: 'เลือกตู้ปลายทาง', icon: 'solar:box-bold-duotone', onClick: picker.onTrue };
  } else if (list.tagEpcs.length === 0) {
    action = { label: mode === 'issue' ? 'สแกนผ้าที่จะจ่ายก่อน' : 'สแกนผ้าที่จะรับคืนก่อน' };
  } else if (lookup.pendingCount > 0) {
    action = { label: `กำลังตรวจสอบแท็ก… (เหลือ ${formatCount(lookup.pendingCount)})` };
  } else if (lookup.failedCount > 0) {
    action = {
      label: 'ตรวจแท็กไม่ครบ — แตะเพื่อลองใหม่',
      icon: 'solar:restart-bold',
      color: 'warning',
      onClick: lookup.retryFailed,
    };
  } else if (validCount === 0) {
    action = { label: mode === 'issue' ? 'ไม่มีผ้าที่จ่ายได้' : 'ไม่มีผ้าที่รับคืนได้' };
  } else if (validCount > MAX_PER_BATCH) {
    action = { label: `บันทึกได้ไม่เกิน ${MAX_PER_BATCH} ชิ้นต่อครั้ง` };
  } else {
    action = {
      label:
        mode === 'issue'
          ? `ยืนยันจ่ายเข้าตู้ · ${formatCount(validCount)} ชิ้น`
          : `ยืนยันรับผ้าคืน · ${formatCount(validCount)} ชิ้น`,
      icon: 'solar:check-read-bold-duotone',
      color: modeMeta.color,
      onClick: handleConfirm,
    };
  }

  // โหมดพอดีจอ (จอ md ขึ้นไป เช่น จอทัชที่จุดสแกน) แบบหน้าสแกนตรวจสอบผ้า: ล็อกไม่ให้ทั้งหน้าเลื่อน
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { ref: fitRef, height: fitHeight } = useFitViewport({ enabled: isDesktop && active });
  const fit = fitHeight !== null;
  const scanButtonHeight = fit ? 60 : 68;

  // ---------- ส่วนแสดงผล ----------
  const renderHeader = (
    <Stack
      direction="row"
      flexWrap="wrap"
      alignItems="center"
      justifyContent="space-between"
      gap={1.5}
      sx={{ px: fit ? 2 : 3, pt: fit ? 2 : 3, flexShrink: 0 }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
        <SectionAvatar icon={modeMeta.icon} color={modeMeta.color} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" noWrap>
            {modeMeta.title}
          </Typography>
          <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary' }}>
            {device
              ? [
                  deviceName(device.device_type),
                  deviceDetail({ ipAddress: device.ip_address, port: device.port }),
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'ยังไม่ได้เลือกเครื่องอ่าน'}
          </Typography>
        </Box>
      </Stack>

      <ToggleButtonGroup
        exclusive
        color={modeMeta.color}
        value={mode}
        disabled={saving}
        onChange={(event, value) => value && setMode(value)}
        aria-label="โหมดสแกน"
      >
        {Object.values(MODES).map((m) => (
          <ToggleButton
            key={m.value}
            value={m.value}
            sx={{ gap: 1, px: 2, minHeight: 44, fontWeight: 700 }}
          >
            <Iconify icon={m.icon} width={20} />
            {m.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );

  const renderPlanToggle = (
    <Box
      component="label"
      sx={{
        px: 1,
        py: 0.75,
        gap: 1,
        flexShrink: 0,
        display: 'flex',
        cursor: 'pointer',
        alignItems: 'center',
        borderRadius: 1.5,
        transition: theme.transitions.create(['background-color', 'border-color']),
        border: `1px solid ${
          usePlan
            ? varAlpha(theme.vars.palette.primary.mainChannel, 0.48)
            : varAlpha(theme.vars.palette.grey['500Channel'], 0.24)
        }`,
        bgcolor: usePlan ? varAlpha(theme.vars.palette.primary.mainChannel, 0.08) : 'transparent',
        '&:hover': { bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08) },
      }}
    >
      <Checkbox
        checked={usePlan}
        onChange={(event) => changeUsePlan(event.target.checked)}
        inputProps={{ 'aria-label': 'เพิ่มผ้าโดยอ้างอิงจากแท็บจัดผ้าเข้ารถ' }}
      />
      <Iconify
        icon="solar:cart-large-4-bold-duotone"
        width={26}
        sx={{ flexShrink: 0, color: usePlan ? 'primary.main' : 'text.disabled' }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2">เพิ่มผ้าโดยอ้างอิงจากแท็บจัดผ้าเข้ารถ</Typography>
        <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
          {usePlan
            ? 'แสดงจำนวนที่ตู้ปลายทางต้องเติมแต่ละประเภท — สแกนครบแล้วการ์ดเป็นสีเขียว'
            : 'ไม่เช็ค = สแกนแบบอิสระ แสดงจำนวนผ้าแยกตามประเภท'}
        </Typography>
      </Box>
    </Box>
  );

  // จอแคบ: ปุ่มอ่านต่อเนื่องเต็มแถว ปุ่มที่เหลือขึ้นแถวใหม่ (gap ไม่ใช่ spacing — spacing ใช้ margin พังตอนตัดแถว)
  const renderScanButtons = (
    <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ flexShrink: 0 }}>
      <Button
        type="button"
        size="large"
        variant="contained"
        color={continuous ? 'error' : 'primary'}
        disabled={!deviceId || scanning || saving}
        onClick={toggleContinuous}
        startIcon={
          <Iconify
            icon={continuous ? 'solar:stop-circle-bold' : 'solar:radar-2-bold-duotone'}
            width={28}
          />
        }
        sx={{
          flex: { xs: '1 1 100%', sm: 1 },
          fontSize: { xs: 18, sm: 20 },
          fontWeight: 700,
          minHeight: scanButtonHeight,
          ...(continuous && {
            animation: 'wardScanPulse 1.6s ease-in-out infinite',
            '@keyframes wardScanPulse': {
              '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 86, 48, 0.45)' },
              '50%': { boxShadow: '0 0 0 10px rgba(255, 86, 48, 0)' },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
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
        disabled={!deviceId || continuous || saving}
        onClick={scanOnce}
        sx={{
          flex: { xs: 1, sm: '0 0 auto' },
          minHeight: scanButtonHeight,
          px: 2.5,
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        อ่านครั้งเดียว
      </LoadingButton>
      <Tooltip title="กรอกรหัส EPC เอง (วางได้หลายรายการ)">
        <Button
          type="button"
          variant="outlined"
          color="inherit"
          disabled={saving}
          onClick={manualDialog.onTrue}
          aria-label="กรอกรหัส EPC เอง"
          sx={{ flexShrink: 0, minWidth: 0, px: 2, minHeight: scanButtonHeight }}
        >
          <Iconify icon="solar:keyboard-bold-duotone" width={26} />
        </Button>
      </Tooltip>
    </Stack>
  );

  const renderToolbar = (
    <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={0.75}
        alignItems="center"
        sx={{ flex: '1 1 240px', minWidth: 0 }}
      >
        <Typography variant="subtitle2" color="text.secondary" sx={{ mr: 0.5 }}>
          {planMode ? 'ผ้าตามแผนจัดผ้าเข้ารถ' : 'ผ้าแยกตามประเภท'}
          {lookup.listedEpcs.length > 0 ? ` (${formatCount(lookup.listedEpcs.length)} ชิ้น)` : ''}
        </Typography>
        {lookup.pendingCount > 0 && (
          <Chip
            size="small"
            variant="soft"
            color="info"
            icon={<Iconify icon="svg-spinners:180-ring" />}
            label={`ตรวจแล้ว ${formatCount(lookup.checkedCount)}/${formatCount(list.tagEpcs.length)}`}
          />
        )}
        {notFoundEpcs.length > 0 && (
          <NotFoundTagsButton epcs={notFoundEpcs} onRemove={list.removeTag} />
        )}
        {lookup.failedCount > 0 && (
          <Chip
            size="small"
            color="warning"
            onClick={lookup.retryFailed}
            icon={<Iconify icon="solar:restart-bold" />}
            label={`ตรวจไม่สำเร็จ ${formatCount(lookup.failedCount)} — แตะเพื่อลองใหม่`}
          />
        )}
      </Stack>
      <Button
        color="inherit"
        variant="outlined"
        disabled={lookup.listedEpcs.length === 0}
        onClick={() => openTags('all', 'รายแท็กทั้งหมด')}
        startIcon={<Iconify icon="solar:list-bold-duotone" />}
        sx={{ flexShrink: 0, minHeight: 44, px: 2 }}
      >
        ดูรายแท็ก
      </Button>
      <Button
        color="error"
        variant="outlined"
        disabled={list.tagEpcs.length === 0 || saving}
        onClick={list.clear}
        startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
        sx={{ flexShrink: 0, minHeight: 44, px: 2, fontWeight: 700 }}
      >
        เคลียร์
      </Button>
    </Stack>
  );

  // แถวสถานะที่ใช้ทั้งสองแบบ: รอตรวจ / ถูกข้าม / ตรวจไม่สำเร็จ
  const renderStatusRows = (
    <>
      {list.pendingEpcs.length > 0 && (
        <WardGroupRow
          icon="svg-spinners:180-ring"
          color="info"
          title="กำลังตรวจสอบกับระบบ"
          caption="ยังไม่รู้ประเภทผ้า — รอสักครู่"
          count={list.pendingEpcs.length}
          onOpen={() => openTags('pending', 'กำลังตรวจสอบกับระบบ')}
        />
      )}
      {list.skipGroups.map((group) => (
        <WardGroupRow
          key={group.kind}
          icon={group.icon}
          color={group.color}
          title={`${group.title} — ข้าม`}
          caption={group.caption}
          count={group.epcs.length}
          onOpen={() => openTags(`skip:${group.kind}`, group.title)}
        />
      ))}
      {list.errorEpcs.length > 0 && (
        <WardGroupRow
          icon="solar:danger-triangle-bold-duotone"
          color="warning"
          title="ตรวจไม่สำเร็จ"
          caption="แตะ “ตรวจไม่สำเร็จ” ด้านบนเพื่อลองใหม่"
          count={list.errorEpcs.length}
          onOpen={() => openTags('error', 'ตรวจไม่สำเร็จ')}
        />
      )}
    </>
  );

  const sectionTitle = (text, extra) => (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, px: 0.5 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary', flex: 1, minWidth: 0 }} noWrap>
        {text}
      </Typography>
      {extra}
    </Stack>
  );

  const cardGrid = {
    display: 'grid',
    gap: 1.25,
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
  };

  let listContent;
  if (planMode && !cabinet) {
    listContent = (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={1.5}
        sx={{ height: 1, p: 3, textAlign: 'center' }}
      >
        <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.lighter', color: 'primary.darker' }}>
          <Iconify icon="solar:cart-large-4-bold-duotone" width={34} />
        </Avatar>
        <Typography variant="h6">เลือกตู้ปลายทางก่อน</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420 }}>
          ระบบจะดึงจำนวนผ้าที่ตู้นั้นต้องเติมแต่ละประเภทจากแท็บ &ldquo;จัดผ้าเข้ารถ&rdquo;
          มาให้สแกนตาม
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={picker.onTrue}
          startIcon={<Iconify icon="solar:box-bold-duotone" />}
          sx={{ minHeight: 48 }}
        >
          เลือกตู้ปลายทาง
        </Button>
      </Stack>
    );
  } else if (planMode) {
    let targetsContent;
    if (plan.targets.length > 0) {
      targetsContent = (
        <Box sx={cardGrid}>
          {plan.targets.map((row) => (
            <WardPlanCard key={row.categoryId} row={row} onOpen={openPlanTags} />
          ))}
        </Box>
      );
    } else {
      targetsContent = (
        <Alert
          severity={cabinet.hasParConfig ? 'success' : 'info'}
          sx={{ bgcolor: 'background.paper' }}
        >
          {cabinet.hasParConfig
            ? 'ตู้นี้มีผ้าครบ Par ทุกประเภทแล้ว — ไม่ต้องเติมตามแผนในรอบนี้'
            : 'ตู้นี้ยังไม่ได้ตั้ง Par — ตั้งได้ที่หน้าโครงสร้างโรงพยาบาล (สแกนแบบอิสระได้ตามปกติ)'}
        </Alert>
      );
    }

    listContent = (
      <Stack spacing={2} sx={{ p: 1.5 }}>
        <Box>
          {sectionTitle(
            `ต้องเติมตามแผน · ${cabinet.cabinetName}`,
            plan.targets.length > 0 && (
              <Label
                color={plan.doneCount === plan.targets.length ? 'success' : 'default'}
                startIcon={<Iconify icon="solar:check-circle-bold" />}
              >
                ครบ {plan.doneCount}/{plan.targets.length} ประเภท
              </Label>
            )
          )}
          {targetsContent}
        </Box>

        {plan.extras.length > 0 && (
          <Box>
            {sectionTitle('นอกแผน — ยังจ่ายเข้าตู้ได้')}
            <Box sx={cardGrid}>
              {plan.extras.map((row) => (
                <WardExtraCard key={row.categoryId} row={row} onOpen={openPlanTags} />
              ))}
            </Box>
          </Box>
        )}

        {(list.pendingEpcs.length > 0 ||
          list.skipGroups.length > 0 ||
          list.errorEpcs.length > 0) && <Stack spacing={1}>{renderStatusRows}</Stack>}
      </Stack>
    );
  } else if (lookup.listedEpcs.length === 0) {
    listContent = (
      <EmptyContent
        title={notFoundEpcs.length > 0 ? 'ยังไม่พบผ้าที่ลงทะเบียน' : 'ยังไม่มีผ้าในรายการ'}
        description={
          continuous
            ? 'กำลังอ่าน… นำผ้าผ่านเครื่องอ่านได้เลย ผ้าที่เจอจะรวมเป็นกลุ่มตามประเภท'
            : 'กด “เริ่มอ่านต่อเนื่อง” แล้วนำผ้าผ่านเครื่องอ่าน — หรือกดปุ่มคีย์บอร์ดเพื่อกรอกรหัส EPC เอง'
        }
        sx={{ py: 3, height: 1, bgcolor: 'transparent' }}
        slotProps={{ img: { maxWidth: fit ? 110 : 150 } }}
      />
    );
  } else {
    listContent = (
      <Stack spacing={1} sx={{ p: 1.5 }}>
        {list.categoryGroups.map((group) => (
          <WardGroupRow
            key={group.categoryId}
            color={modeMeta.color}
            title={group.name}
            caption={
              group.transferCount > 0
                ? `ย้ายจากตู้อื่น ${formatCount(group.transferCount)} ชิ้น`
                : mode === 'issue'
                  ? 'จ่ายเข้าตู้ได้'
                  : 'รับคืนได้'
            }
            count={group.epcs.length}
            onOpen={() => openTags(`cat:${group.categoryId}`, group.name)}
          />
        ))}
        {renderStatusRows}
      </Stack>
    );
  }

  const renderList = (
    <Box
      sx={{
        ...(fit ? { flex: 1, minHeight: 120 } : { height: 440 }),
        borderRadius: 1.5,
        bgcolor: 'background.neutral',
        overflowY: 'auto',
        overscrollBehavior: 'contain', // ปัดรายการจนสุดแล้วไม่ลากทั้งหน้าตาม
      }}
    >
      {listContent}
    </Box>
  );

  const cabinetState = cabinet ? cabinetPlanState(cabinet) : null;
  const renderDestination = (
    <Card sx={{ flexShrink: 0 }}>
      <CardContent sx={{ ...(fit && { p: 2, pb: '16px !important' }) }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          ตู้ปลายทาง
        </Typography>
        <ButtonBase
          disabled={saving}
          onClick={picker.onTrue}
          aria-label={cabinet ? `เปลี่ยนตู้ปลายทาง (${cabinet.cabinetName})` : 'เลือกตู้ปลายทาง'}
          sx={{
            mt: 1,
            p: 1.5,
            gap: 1.5,
            width: 1,
            minHeight: 76,
            textAlign: 'left',
            borderRadius: 1.5,
            justifyContent: 'flex-start',
            transition: theme.transitions.create(['background-color', 'border-color']),
            ...(cabinet
              ? {
                  border: `2px solid ${theme.vars.palette.primary.main}`,
                  bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.06),
                }
              : {
                  border: `2px dashed ${varAlpha(theme.vars.palette.primary.mainChannel, 0.48)}`,
                  bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.04),
                  '&:hover': { bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.1) },
                  ...(!saving && {
                    animation: 'wardPickPulse 2s ease-in-out infinite',
                    '@keyframes wardPickPulse': {
                      '0%, 100%': {
                        borderColor: varAlpha(theme.vars.palette.primary.mainChannel, 0.32),
                      },
                      '50%': { borderColor: theme.vars.palette.primary.main },
                    },
                    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                  }),
                }),
          }}
        >
          <Avatar
            variant="rounded"
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1.5,
              color: 'common.white',
              bgcolor: 'primary.main',
            }}
          >
            <Iconify icon={cabinet ? 'solar:box-bold-duotone' : 'mingcute:add-line'} width={28} />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {cabinet ? cabinet.cabinetName : 'แตะเพื่อเลือกตู้'}
            </Typography>
            {cabinet ? (
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ color: 'text.secondary', minWidth: 0 }}>
                  {cabinet.wardName}
                </Typography>
                <Label color={cabinetState.color} sx={{ flexShrink: 0 }}>
                  {cabinetState.label}
                </Label>
              </Stack>
            ) : (
              <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
                ตู้ประจำวอร์ดที่จะจ่ายผ้าเข้า
              </Typography>
            )}
          </Box>
          {cabinet ? (
            <Label color="primary" sx={{ height: 30, px: 1.25, flexShrink: 0 }}>
              เปลี่ยน
            </Label>
          ) : (
            <Iconify icon="eva:arrow-ios-forward-fill" sx={{ color: 'primary.main' }} />
          )}
        </ButtonBase>
      </CardContent>
    </Card>
  );

  const pill = (key, icon, text) => (
    <Stack
      key={key}
      direction="row"
      spacing={0.5}
      alignItems="center"
      sx={{
        px: 1.25,
        py: 0.25,
        borderRadius: 5,
        typography: 'caption',
        fontWeight: 600,
        bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
      }}
    >
      <Iconify icon={icon} width={14} />
      <span>{text}</span>
    </Stack>
  );

  const planAllDone = planMode && cabinet && plan.targets.length > 0 && missingTargets.length === 0;

  const renderHero = (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        color: 'common.white',
        ...bgGradient({
          color: `135deg, ${theme.vars.palette[modeMeta.color].main} 0%, ${theme.vars.palette[modeMeta.color].darker} 100%`,
        }),
        ...(fit ? { flex: '1 1 0', minHeight: 0 } : { flexGrow: 1, minHeight: 240 }),
      }}
    >
      <Iconify
        icon={modeMeta.icon}
        width={150}
        sx={{ position: 'absolute', right: -28, bottom: -34, opacity: 0.14 }}
      />
      {continuous && (
        <Label
          variant="filled"
          color="error"
          startIcon={<Iconify icon="svg-spinners:pulse-2" />}
          sx={{ position: 'absolute', top: 16, right: 16 }}
        >
          กำลังอ่าน
        </Label>
      )}
      <CardContent
        sx={{
          height: 1,
          display: 'flex',
          textAlign: 'center',
          alignItems: 'center',
          position: 'relative',
          flexDirection: 'column',
          justifyContent: 'center',
          ...(fit && { py: '12px !important' }),
        }}
      >
        <Typography sx={{ opacity: 0.9, fontWeight: 700, fontSize: 14 }}>
          {modeMeta.heroLabel}
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <Typography
            sx={{
              lineHeight: 1.05,
              fontWeight: 800,
              fontSize: fit ? 'clamp(48px, 10vh, 120px)' : { xs: 96, sm: 120 },
            }}
          >
            {formatCount(validCount)}
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9 }}>
            ชิ้น
          </Typography>
        </Stack>
        {list.lastAddedCount > 0 && validCount > 0 && (
          <Typography variant="caption" sx={{ opacity: 0.85 }}>
            +{formatCount(list.lastAddedCount)} ล่าสุด
          </Typography>
        )}

        {planMode && cabinet && plan.targets.length > 0 && (
          <Box sx={{ mt: 1.5, width: 1, maxWidth: 360 }}>
            {planAllDone ? (
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                justifyContent="center"
                sx={{ mb: 0.75, typography: 'subtitle2' }}
              >
                <Iconify icon="solar:check-circle-bold" width={20} />
                <span>ครบตามแผนทุกประเภทแล้ว</span>
              </Stack>
            ) : (
              <Stack
                direction="row"
                justifyContent="space-between"
                sx={{ typography: 'caption', opacity: 0.9, mb: 0.5 }}
              >
                <span>
                  ครบตามแผน {plan.doneCount}/{plan.targets.length} ประเภท
                </span>
                <span>
                  {formatCount(plan.coveredQty)}/{formatCount(plan.plannedQty)} ชิ้น
                </span>
              </Stack>
            )}
            <LinearProgress
              variant="determinate"
              value={plan.percent}
              sx={{
                height: 8,
                borderRadius: 1,
                bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.24),
                '& .MuiLinearProgress-bar': { bgcolor: 'common.white', borderRadius: 1 },
              }}
            />
          </Box>
        )}

        {(list.transferCount > 0 || list.skippedCount > 0) && (
          <Stack
            direction="row"
            flexWrap="wrap"
            gap={0.75}
            justifyContent="center"
            sx={{ mt: 1.5 }}
          >
            {list.transferCount > 0 &&
              pill(
                'transfer',
                'solar:transfer-horizontal-bold',
                `ย้ายจากตู้อื่น ${formatCount(list.transferCount)}`
              )}
            {list.skipGroups.map((group) =>
              pill(
                group.kind,
                'solar:forbidden-circle-bold',
                `${group.title} ${formatCount(group.epcs.length)}`
              )
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );

  const renderLastResult = lastResult && list.tagEpcs.length === 0 && (
    <Card sx={{ flexShrink: 0 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: 2 }}>
        <Avatar sx={{ bgcolor: 'success.lighter', color: 'success.darker' }}>
          <Iconify icon="solar:check-circle-bold-duotone" width={24} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2">
            {lastResult.mode === 'issue'
              ? `จ่ายเข้า ${lastResult.cabinetName} แล้ว ${formatCount(lastResult.count)} ชิ้น`
              : `รับผ้าคืนแล้ว ${formatCount(lastResult.count)} ชิ้น`}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            เมื่อ{' '}
            {lastResult.at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
            {lastResult.skipped ? ` · ข้าม ${formatCount(lastResult.skipped)} ชิ้น` : ''}
          </Typography>
          {lastResult.breakdown.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>
              {lastResult.breakdown.slice(0, 4).map((row) => (
                <Chip
                  key={row.name}
                  size="small"
                  variant="soft"
                  label={`${row.name} ${formatCount(row.count)}`}
                />
              ))}
              {lastResult.breakdown.length > 4 && (
                <Chip
                  size="small"
                  variant="soft"
                  label={`+${lastResult.breakdown.length - 4} ประเภท`}
                />
              )}
            </Stack>
          )}
        </Box>
        <IconButton size="small" aria-label="ปิด" onClick={() => setLastResult(null)}>
          <Iconify icon="mingcute:close-line" width={18} />
        </IconButton>
      </Stack>
    </Card>
  );

  return (
    <>
      {/* CSS grid + gap (ไม่ใช้ MUI Grid) — ตำแหน่งที่ useFitViewport วัดไม่ขยับตามโหมด ดู change-category-card.jsx */}
      <Box
        ref={fitRef}
        sx={{
          gap: fit ? 2 : 3,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 4fr)' },
          touchAction: 'manipulation', // ปิด double-tap zoom บนจอทัช แต่ยังปัด/ซูมสองนิ้วได้
          ...(fit && { height: fitHeight, gridTemplateRows: 'minmax(0, 1fr)' }),
        }}
      >
        <Card sx={{ display: 'flex', flexDirection: 'column' }}>
          {renderHeader}
          <CardContent
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: fit ? 1.5 : 2,
              ...(fit && { p: 2, pt: 1.5, pb: '16px !important' }),
            }}
          >
            {!canEdit && (
              <Alert severity="info" sx={{ flexShrink: 0 }}>
                บัญชีนี้ดูได้อย่างเดียว — ต้องได้รับสิทธิ์ &ldquo;แก้ไข: รับ-ส่งผ้าประจำวอร์ด&rdquo;
                จึงจะบันทึกจ่าย/รับผ้าได้
              </Alert>
            )}
            {!devicesLoading && devices.length === 0 && (
              <Alert severity="warning" sx={{ flexShrink: 0 }}>
                ยังไม่มีเครื่องอ่าน RFID ประเภท &ldquo;จุดตรวจสอบ&rdquo; ที่ผูกกับโรงพยาบาลนี้ —
                เพิ่มได้ในหน้า &ldquo;อุปกรณ์ & สัญญาณ RFID&rdquo; หรือกดปุ่มคีย์บอร์ดเพื่อกรอกรหัส
                EPC เองไปก่อน
              </Alert>
            )}
            <ReaderNotSelectedAlert reader={reader} onOpenReader={onOpenReader} />
            {mode === 'issue' && renderPlanToggle}
            {renderScanButtons}
            {renderToolbar}
            {renderList}
          </CardContent>
        </Card>

        <Stack spacing={fit ? 2 : 2.5} sx={{ minHeight: 0 }}>
          {mode === 'issue' && renderDestination}
          {renderHero}
          {renderLastResult}
          <LoadingButton
            fullWidth
            type="button"
            size="large"
            variant="contained"
            color={action.color ?? 'primary'}
            loading={saving}
            disabled={!action.onClick || scanning}
            onClick={action.onClick}
            startIcon={action.icon ? <Iconify icon={action.icon} width={26} /> : undefined}
            sx={{ flexShrink: 0, fontSize: 18, fontWeight: 700, minHeight: 64 }}
          >
            {action.label}
          </LoadingButton>
        </Stack>
      </Box>

      <WardCabinetPickerDialog
        open={picker.value}
        cabinets={planCabinets}
        loading={cartPlanLoading}
        value={cabinetId}
        onClose={picker.onFalse}
        onSelect={(id) => {
          setCabinetId(id);
          picker.onFalse();
        }}
      />

      <ChangeCategoryManualDialog
        open={manualDialog.value}
        onClose={manualDialog.onFalse}
        onAdd={(codes) => {
          handleAddCodes(codes);
          manualDialog.onFalse();
        }}
      />

      <WardTagsDialog
        open={!!tagView}
        title={tagView?.title ?? ''}
        epcs={tagViewEpcs}
        results={lookup.results}
        kinds={list.kinds}
        onRemove={list.removeTag}
        onOpenProfile={(epc) => setProfile({ epc, open: true })}
        onClose={() => setTagView(null)}
      />

      <Dialog
        open={incompleteDialog.value}
        onClose={incompleteDialog.onFalse}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ pb: 1 }}>ยังไม่ครบตามแผน</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            ประเภทที่ยังขาดตามแผนจัดผ้าเข้ารถของ {cabinet?.cabinetName}
          </Typography>
          <Stack spacing={0.75} sx={{ mb: 2 }}>
            {missingTargets.map((row) => (
              <Stack
                key={row.categoryId}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ px: 1.25, py: 0.75, borderRadius: 1, bgcolor: 'background.neutral' }}
              >
                <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {row.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {formatCount(row.scanned)}/{formatCount(row.target)}
                </Typography>
                <Label color="warning">ขาด {formatCount(row.target - row.scanned)}</Label>
              </Stack>
            ))}
          </Stack>
          <Typography variant="body2">
            ยืนยันจ่ายเข้าตู้เท่าที่สแกนได้ {formatCount(validCount)} ชิ้นหรือไม่?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="inherit"
            onClick={incompleteDialog.onFalse}
            sx={{ minHeight: 44 }}
          >
            สแกนต่อ
          </Button>
          <LoadingButton
            variant="contained"
            color="primary"
            loading={saving}
            onClick={save}
            sx={{ minHeight: 44 }}
          >
            ยืนยันจ่าย {formatCount(validCount)} ชิ้น
          </LoadingButton>
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
