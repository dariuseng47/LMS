'use client';

import { memo, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useBoolean } from 'src/hooks/use-boolean';
import { useAutoScan } from 'src/hooks/use-auto-scan';
import { useFitViewport } from 'src/hooks/use-fit-viewport';

import { fTime } from 'src/utils/format-time';

import { varAlpha, bgGradient } from 'src/theme/styles';
import { scanCheckpoint } from 'src/actions/rfidReader';
import { bulkCreateFabricItems } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { deviceName, deviceDetail } from 'src/sections/devices/device-constants';
import { ReaderNotSelectedAlert } from 'src/sections/operations/view/scan-reader-tab';

import { useRegisterCheck } from '../use-register-check';
import { DuplicateTagsButton } from './duplicate-tags-button';
import { RegisterSettingTile } from './register-setting-tile';
import { RegisterManualDialog } from './register-manual-dialog';
import { lotLines, lineProgress, resolveTarget } from '../register-target';

// ----------------------------------------------------------------------

const MAX_EPC_PER_REQUEST = 500; // ต้องตรงกับ bulkCreateFabricItemsSchema ฝั่ง server

// อ่านต่อเนื่องนานสุดเท่านี้แล้วหยุดเอง กันลืมเปิดเครื่องอ่านทิ้งไว้ (แบบเดียวกับหน้าสแกนเข้าสต๊อค)
const MAX_CONTINUOUS_MS = 10 * 60 * 1000;

const BIG_NUMBER_FIT = 'clamp(64px, 18vh, 168px)';

const progressPercent = ({ registered, quantity }, adding) =>
  quantity ? Math.min(100, ((registered + adding) / quantity) * 100) : 0;

const shortEpc = (epc) => (epc.length > 12 ? `…${epc.slice(-8)}` : epc);

// state: undefined = รอตรวจ | 'notFound' = ผ้าใหม่ | 'error' = ตรวจไม่สำเร็จ
const RegisterTagChip = memo(({ epc, state, selected, onToggle }) => {
  let icon = 'svg-spinners:180-ring';
  if (state === 'error') icon = 'solar:danger-triangle-bold';
  else if (state) icon = selected ? 'eva:checkmark-fill' : 'eva:minus-fill';

  return (
    <Chip
      clickable
      size="small"
      title={epc}
      label={shortEpc(epc)}
      onClick={() => onToggle(epc)}
      color={state === 'error' ? 'warning' : selected ? 'primary' : 'default'}
      variant={selected ? 'filled' : 'outlined'}
      icon={<Iconify icon={icon} width={16} />}
      sx={{ fontFamily: 'monospace' }}
    />
  );
});

// ----------------------------------------------------------------------

/**
 * สแกนลงทะเบียนผ้าใหม่ — หน้าเดียวแบบ "สแกนเข้าสต๊อค" (รวมแท็บสแกนผ่านจุดตรวจสอบ + ลงทะเบียนรายชิ้นเดิม)
 * เลือกประเภทผ้า + ล็อต (ไม่บังคับ) แล้วอ่านแท็ก หรือพิมพ์/วางรหัสเอง -> ตรวจซ้ำ -> ยืนยันลงทะเบียน
 *
 * reader = ผลจาก useScanReader (ประตูชั่งน้ำหนัก + จุดตรวจสอบ เลือกในแท็บ "เครื่องอ่าน") | canUseReader = มีสิทธิ์สั่งเครื่องอ่าน
 * (ไม่มี = พิมพ์/วางรหัสได้อย่างเดียว) | canEdit = มีสิทธิ์ลงทะเบียน | active = แท็บนี้เปิดอยู่ (สลับแท็บการ์ดแค่ถูกซ่อน)
 */
export function RegisterScanCard({
  hospitalId,
  lots,
  categories,
  target,
  onOpenCategory,
  onOpenLot,
  reader,
  onOpenReader,
  canUseReader,
  canEdit,
  active,
  onRegistered,
  onOpenHistory,
}) {
  const theme = useTheme();
  const manualDialog = useBoolean();

  const { devices, devicesLoading, deviceId } = reader;
  const device = devices.find((d) => d.id === deviceId);

  const { lot, category, line, notInLot } = useMemo(
    () => resolveTarget(target, lots, categories),
    [target, lots, categories]
  );

  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // { createdCount, skippedCount, title, at } ของการยืนยันครั้งล่าสุด
  const [lastResult, setLastResult] = useState(null);

  // Map<epc, { epc, selected, deviceId }> — deviceId = เครื่องที่อ่านเจอครั้งแรก (null = พิมพ์/วางเอง)
  // เก็บรายแท็กเพราะเปลี่ยนเครื่องกลางคันได้ ประวัติต้องบอกเครื่องถูกต้อง
  const [foundTags, setFoundTags] = useState(new Map());

  // แท็กที่มีอยู่แล้วไม่แตะต้อง (ตัวที่ผู้ใช้แตะยกเลิกไว้ต้องไม่ถูกเลือกกลับมาเองเมื่อเครื่องอ่านเจอซ้ำ)
  const addTags = useCallback((codes, fromDeviceId) => {
    setFoundTags((prev) => {
      const fresh = codes.filter((epc) => !prev.has(epc));
      if (fresh.length === 0) return prev;
      const next = new Map(prev);
      fresh.forEach((epc) => next.set(epc, { epc, selected: true, deviceId: fromDeviceId }));
      return next;
    });
  }, []);

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const { epcs } = await scanCheckpoint(Number(deviceId), hospitalId);
      addTags(
        epcs.map((tag) => tag.epc),
        deviceId
      );
      if (epcs.length === 0) toast.error('ไม่พบแท็กในระยะสัญญาณ');
    } catch (error) {
      toast.error(
        error?.message || 'สแกนไม่สำเร็จ — ตรวจสอบว่าเครื่องอ่านเปิดอยู่และเชื่อมเครือข่ายได้'
      );
    } finally {
      setScanning(false);
    }
  }, [deviceId, hospitalId, addTags]);

  // เปลี่ยนเครื่องต้องไปแท็บ "เครื่องอ่าน" ซึ่งหยุดอ่านต่อเนื่องก่อน deviceId จึงเป็นเครื่องที่กำลังอ่านเสมอ
  const handleContinuousTags = useCallback(
    (epcs) =>
      addTags(
        epcs.map((tag) => tag.epc),
        deviceId
      ),
    [addTags, deviceId]
  );
  const {
    running: continuous,
    start: startContinuous,
    stop: stopContinuous,
  } = useAutoScan({ hospitalId, onTags: handleContinuousTags, maxErrors: 3 });

  // นับเวลาที่อ่านต่อเนื่องไปแล้ว + หยุดเองเมื่อครบเพดาน
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

  // ออกจากแท็บสแกน (การ์ดยังอยู่ ไม่ถูกถอด รายการไม่หาย) -> หยุดอ่าน
  useEffect(() => {
    if (!active) stopContinuous();
  }, [active, stopContinuous]);

  const handleToggleContinuous = useCallback(() => {
    if (continuous) stopContinuous();
    else startContinuous(Number(deviceId));
  }, [continuous, deviceId, startContinuous, stopContinuous]);

  const handleManualAdd = useCallback(
    (codes) => {
      const added = codes.filter((epc) => !foundTags.has(epc)).length;
      addTags(codes, null);
      toast.success(
        added ? `เพิ่มเข้ารายการ ${added} รายการ` : 'รหัสที่กรอกอยู่ในรายการแล้วทั้งหมด'
      );
    },
    [addTags, foundTags]
  );

  const handleToggleTag = useCallback((epc) => {
    setFoundTags((prev) => {
      const tag = prev.get(epc);
      if (!tag) return prev;
      const next = new Map(prev);
      next.set(epc, { ...tag, selected: !tag.selected });
      return next;
    });
  }, []);

  const handleClear = useCallback(() => setFoundTags(new Map()), []);

  // ---------- ตรวจซ้ำกับระบบ ----------
  const tagEpcs = useMemo(() => [...foundTags.keys()], [foundTags]);
  const check = useRegisterCheck(tagEpcs, hospitalId);
  const selectedTags = useMemo(
    () => check.newEpcs.map((epc) => foundTags.get(epc)).filter((tag) => tag?.selected),
    [check.newEpcs, foundTags]
  );
  const selectedCount = selectedTags.length;

  // เทียบกับจำนวนสั่งซื้อของประเภทนี้ในล็อต
  const progress = line ? lineProgress(line) : null;
  const overQuota = progress?.quantity ? Math.max(0, selectedCount - progress.remaining) : 0;

  // อ่านครั้งเดียวค้างอยู่ -> รอผลก่อน (แท็กที่มาทีหลังจะหลุดจากชุดที่ยืนยัน)
  const canConfirm = canEdit && !!category && selectedCount > 0 && check.ready && !scanning;

  // ---------- ยืนยัน ----------
  const handleConfirm = useCallback(async () => {
    stopContinuous(); // หยุดอ่านก่อนยืนยัน กันแท็กไหลเข้ามาหลังยืนยันชุดนี้ไปแล้ว
    setConfirming(true);

    // แยกตามเครื่องที่อ่าน (ประวัติ 1 รอบ = 1 เครื่อง) แล้วซอยเป็นก้อนไม่เกินที่ server รับต่อครั้ง
    const byDevice = new Map();
    selectedTags.forEach((tag) => {
      if (!byDevice.has(tag.deviceId)) byDevice.set(tag.deviceId, []);
      byDevice.get(tag.deviceId).push(tag.epc);
    });
    const requests = [];
    byDevice.forEach((codes, tagDeviceId) => {
      for (let i = 0; i < codes.length; i += MAX_EPC_PER_REQUEST) {
        requests.push({ tagDeviceId, epcCodes: codes.slice(i, i + MAX_EPC_PER_REQUEST) });
      }
    });

    let createdCount = 0;
    let skippedCount = 0;
    const result = () => ({ createdCount, skippedCount, title: category.name, at: new Date() });

    try {
      for (let i = 0; i < requests.length; i += 1) {
        const { tagDeviceId, epcCodes } = requests[i];
        // eslint-disable-next-line no-await-in-loop
        const { created, skipped } = await bulkCreateFabricItems({
          epcCodes,
          fabricLotId: lot?.id,
          fabricCategoryId: category.id,
          deviceId: tagDeviceId ?? undefined,
          hospitalId,
        });
        createdCount += created.length;
        skippedCount += skipped.length;
        // เอาก้อนที่ลงทะเบียนแล้วออกจากรายการทันที — ก้อนถัดไปพลาดแล้วกดใหม่จะไม่ส่งซ้ำ
        setFoundTags((prev) => {
          const next = new Map(prev);
          epcCodes.forEach((epc) => next.delete(epc));
          return next;
        });
      }
      setFoundTags(new Map());
      setLastResult(result());
      toast.success(
        `ลงทะเบียนผ้าสำเร็จ ${createdCount} ชิ้น${
          skippedCount ? ` (ข้าม ${skippedCount} ชิ้นที่ซ้ำในระบบ)` : ''
        }`
      );
      if (notInLot && createdCount > 0) {
        toast.info(`เพิ่มประเภท “${category.name}” เข้าล็อต ${lot.lot_code} ให้แล้ว`);
      }
    } catch (error) {
      if (createdCount > 0) setLastResult(result());
      toast.error(
        `${error?.message || 'ลงทะเบียนผ้าไม่สำเร็จ'}${
          createdCount > 0 ? ` (ลงทะเบียนไปแล้ว ${createdCount} ชิ้น ที่เหลือยังอยู่ในรายการ)` : ''
        }`
      );
    } finally {
      setConfirming(false);
      if (createdCount > 0) onRegistered();
    }
  }, [selectedTags, lot, category, notInLot, hospitalId, stopContinuous, onRegistered]);

  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { ref: fitRef, height: fitHeight } = useFitViewport({ enabled: isDesktop && active });
  const fit = fitHeight !== null;

  // ---------- ส่วนแสดงผล ----------
  const lotDetail = () => {
    if (!lot) return 'ไม่บังคับ';
    if (!progress) return `${lotLines(lot).length} ประเภทในล็อต`;
    return progress.quantity
      ? `ลงแล้ว ${progress.registered.toLocaleString('th-TH')}/${progress.quantity.toLocaleString('th-TH')} ชิ้น`
      : `ลงแล้ว ${progress.registered.toLocaleString('th-TH')} ชิ้น`;
  };

  const renderSettings = (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ flexShrink: 0 }}>
      <RegisterSettingTile
        icon="solar:t-shirt-bold-duotone"
        label="ประเภทผ้า"
        title={category?.name ?? 'แตะเพื่อเลือกประเภทผ้า'}
        detail={category?.group_name}
        tone={category ? 'primary' : 'warning'}
        disabled={confirming}
        onClick={onOpenCategory}
      />
      <RegisterSettingTile
        icon="solar:box-bold-duotone"
        label="ล็อต"
        title={lot?.lot_code ?? 'ไม่ผูกล็อต'}
        detail={lotDetail()}
        tone={(notInLot && 'warning') || (lot ? 'primary' : 'default')}
        disabled={confirming}
        onClick={onOpenLot}
      />
    </Stack>
  );

  const buttonHeight = fit ? 60 : 72;

  const renderActions = canUseReader ? (
    <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
      <Button
        type="button"
        size="large"
        variant="contained"
        color={continuous ? 'error' : 'primary'}
        disabled={!deviceId || scanning || confirming}
        onClick={handleToggleContinuous}
        startIcon={
          <Iconify
            icon={continuous ? 'solar:stop-circle-bold' : 'solar:radar-2-bold-duotone'}
            width={30}
          />
        }
        sx={{
          flex: 1,
          fontSize: 22,
          fontWeight: 700,
          minHeight: buttonHeight,
          ...(continuous && {
            animation: 'registerScanPulse 1.6s ease-in-out infinite',
            '@keyframes registerScanPulse': {
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
        disabled={!deviceId || continuous || confirming}
        onClick={handleScan}
        sx={{ flexShrink: 0, minHeight: buttonHeight, px: 2.5, fontWeight: 700, fontSize: 16 }}
      >
        อ่านครั้งเดียว
      </LoadingButton>
    </Stack>
  ) : (
    // สั่งเครื่องอ่านไม่ได้ -> พิมพ์/วางรหัสเป็นทางเดียว จึงเป็นปุ่มใหญ่
    <Button
      fullWidth
      type="button"
      size="large"
      color="primary"
      variant="contained"
      disabled={confirming}
      onClick={manualDialog.onTrue}
      startIcon={<Iconify icon="solar:keyboard-bold-duotone" width={28} />}
      sx={{ flexShrink: 0, fontSize: 20, fontWeight: 700, minHeight: buttonHeight }}
    >
      พิมพ์ / วางรหัส EPC
    </Button>
  );

  const renderStatusChips = tagEpcs.length > 0 && (
    <Stack direction="row" flexWrap="wrap" gap={1} sx={{ flexShrink: 0 }}>
      <Chip
        size="small"
        variant="soft"
        color={check.pendingCount > 0 ? 'info' : 'success'}
        icon={
          <Iconify
            icon={check.pendingCount > 0 ? 'svg-spinners:180-ring' : 'solar:check-circle-bold'}
          />
        }
        label={`ตรวจแล้ว ${check.checkedCount}/${tagEpcs.length}`}
      />
      {check.duplicates.length > 0 && <DuplicateTagsButton duplicates={check.duplicates} />}
      {check.failedCount > 0 && (
        <Chip
          size="small"
          color="warning"
          onClick={check.retryFailed}
          icon={<Iconify icon="solar:restart-bold" />}
          label={`ตรวจไม่สำเร็จ ${check.failedCount} — แตะเพื่อลองใหม่`}
        />
      )}
    </Stack>
  );

  const renderTagList = (
    <Box
      sx={{
        // โหมดพอดีจอ = กินพื้นที่ที่เหลือทั้งหมด แท็กเยอะก็เลื่อนในกล่องนี้ที่เดียว
        ...(fit ? { flex: 1, minHeight: 96 } : { height: 260 }),
        borderRadius: 1.5,
        bgcolor: 'background.neutral',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      {check.newEpcs.length === 0 ? (
        <EmptyContent
          title={check.duplicates.length > 0 ? 'ยังไม่พบผ้าใหม่' : 'ยังไม่มีแท็ก'}
          description={
            continuous
              ? 'กำลังอ่าน… วางผ้าที่เครื่องอ่านได้เลย แท็กที่เจอจะขึ้นที่นี่'
              : canUseReader
                ? 'กด “เริ่มอ่านต่อเนื่อง” หรือ “อ่านครั้งเดียว” เพื่ออ่านแท็ก'
                : 'กด “พิมพ์ / วางรหัส EPC” เพื่อเพิ่มผ้าเข้ารายการ'
          }
          sx={{ py: 2, height: 1, bgcolor: 'transparent' }}
          slotProps={{ img: { maxWidth: fit ? 88 : 140 } }}
        />
      ) : (
        <Box sx={{ p: 1.5, gap: 1, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start' }}>
          {check.newEpcs.map((epc) => (
            <RegisterTagChip
              key={epc}
              epc={epc}
              state={check.results[epc]?.state}
              selected={!!foundTags.get(epc)?.selected}
              onToggle={handleToggleTag}
            />
          ))}
        </Box>
      )}
    </Box>
  );

  const renderHero = (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        color: 'common.white',
        ...bgGradient({
          color: `to bottom, ${theme.vars.palette.info.dark} 0%, ${theme.vars.palette.info.darker} 100%`,
        }),
        ...(fit ? { flex: '1 1 0', minHeight: 0 } : { flexGrow: 1 }),
      }}
    >
      <Iconify
        icon="solar:t-shirt-bold-duotone"
        width={140}
        sx={{ position: 'absolute', right: -24, bottom: -28, opacity: 0.14 }}
      />
      <CardContent
        sx={{
          height: 1,
          display: 'flex',
          position: 'relative',
          textAlign: 'center',
          flexDirection: 'column',
          justifyContent: 'center',
          ...(fit && { py: '12px !important' }),
        }}
      >
        <Typography sx={{ opacity: 0.9, fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>
          จำนวนที่จะลงทะเบียน
        </Typography>
        <Typography
          sx={{
            lineHeight: 1,
            fontWeight: 700,
            fontSize: fit ? BIG_NUMBER_FIT : { xs: 120, sm: 168 },
          }}
        >
          {selectedCount.toLocaleString('th-TH')}
        </Typography>
        <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
          ชิ้น
          {check.newEpcs.length !== selectedCount
            ? ` · ผ้าใหม่ที่พบ ${check.newEpcs.length.toLocaleString('th-TH')} ชิ้น`
            : ''}
        </Typography>

        {category && (
          <Typography variant="h6" noWrap sx={{ mt: 1 }}>
            {category.name}
          </Typography>
        )}

        {lot && progress && (
          <Box sx={{ mt: 1.5, mx: 'auto', width: 1, maxWidth: 360 }}>
            {/* ขาวทึบ = ลงทะเบียนแล้ว, ขาวจาง = ชุดที่กำลังจะยืนยัน (ประเภทที่ไม่มีจำนวนสั่งซื้อ ไม่มีแถบให้เทียบ) */}
            {progress.quantity && (
              <Box
                sx={{
                  height: 8,
                  mb: 0.75,
                  borderRadius: 1,
                  overflow: 'hidden',
                  position: 'relative',
                  bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
                }}
              >
                {[
                  { percent: progressPercent(progress, selectedCount), opacity: 0.48 },
                  { percent: progressPercent(progress, 0), opacity: 1 },
                ].map(({ percent, opacity }) => (
                  <Box
                    key={opacity}
                    style={{ width: `${percent}%` }}
                    sx={{
                      top: 0,
                      left: 0,
                      height: 1,
                      position: 'absolute',
                      bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, opacity),
                    }}
                  />
                ))}
              </Box>
            )}
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
              ล็อต {lot.lot_code} · {lotDetail()}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const renderConfirm = category ? (
    <LoadingButton
      fullWidth
      type="button"
      size="large"
      variant="contained"
      color="primary"
      loading={confirming}
      disabled={!canConfirm}
      onClick={handleConfirm}
      startIcon={<Iconify icon="solar:check-read-bold-duotone" width={26} />}
      sx={{ flexShrink: 0, py: 1.5, fontSize: 18, fontWeight: 700, minHeight: 60 }}
    >
      {tagEpcs.length > 0 && check.pendingCount > 0
        ? `กำลังตรวจสอบแท็ก… (เหลือ ${check.pendingCount})`
        : check.failedCount > 0
          ? 'ตรวจแท็กไม่ครบ — ลองใหม่ก่อนยืนยัน'
          : `ยืนยันลงทะเบียนผ้า${selectedCount > 0 ? ` ${selectedCount.toLocaleString('th-TH')} ชิ้น` : ''}`}
    </LoadingButton>
  ) : (
    <Button
      fullWidth
      type="button"
      size="large"
      variant="contained"
      color="warning"
      onClick={onOpenCategory}
      startIcon={<Iconify icon="solar:t-shirt-bold-duotone" width={26} />}
      sx={{ flexShrink: 0, py: 1.5, fontSize: 18, fontWeight: 700, minHeight: 60 }}
    >
      เลือกประเภทผ้าก่อน
    </Button>
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
        <Grid item xs={12} md={7} sx={fit ? { height: 1 } : undefined}>
          <Card sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
            <CardContent
              sx={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: fit ? 1.5 : 2,
                ...(fit && { p: 2, pb: '16px !important' }),
              }}
            >
              {!canEdit && (
                <Alert severity="info" sx={{ flexShrink: 0 }}>
                  บัญชีนี้ดูได้อย่างเดียว ลงทะเบียนผ้าไม่ได้ — ติดต่อผู้ดูแลระบบให้เปิดสิทธิ์แก้ไขเมนูนี้
                </Alert>
              )}
              {canUseReader && !devicesLoading && devices.length === 0 && (
                <Alert severity="warning" sx={{ flexShrink: 0 }}>
                  ยังไม่มีเครื่องอ่าน RFID ในโรงพยาบาลนี้ — เพิ่มในหน้า “อุปกรณ์ & สัญญาณ RFID” ก่อน
                  หรือกดปุ่มคีย์บอร์ดเพื่อพิมพ์ / วางรหัสเอง
                </Alert>
              )}

              {canUseReader && (
                <ReaderNotSelectedAlert reader={reader} onOpenReader={onOpenReader} />
              )}

              {renderSettings}
              {renderActions}

              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ flexShrink: 0 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    ผ้าใหม่ที่พบ
                    {check.newEpcs.length > 0
                      ? ` (${check.newEpcs.length.toLocaleString('th-TH')}) — แตะเพื่อเลือก/ยกเลิก`
                      : ''}
                  </Typography>
                  {device && (
                    <Typography variant="caption" noWrap component="div" color="text.disabled">
                      อ่านด้วย{deviceName(device.device_type)}
                      {device.ip_address
                        ? ` · ${deviceDetail({ ipAddress: device.ip_address, port: device.port })}`
                        : ''}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  {canUseReader && (
                    <Tooltip title="พิมพ์ / วางรหัส EPC">
                      {/* span ครอบไว้ ให้ tooltip ยังทำงานตอนปุ่มถูก disable */}
                      <span>
                        <Button
                          color="inherit"
                          variant="outlined"
                          aria-label="พิมพ์ / วางรหัส EPC"
                          disabled={confirming}
                          onClick={manualDialog.onTrue}
                          sx={{ minWidth: 52, minHeight: 44, px: 1 }}
                        >
                          <Iconify icon="solar:keyboard-bold-duotone" width={26} />
                        </Button>
                      </span>
                    </Tooltip>
                  )}
                  <Button
                    color="error"
                    variant="outlined"
                    disabled={tagEpcs.length === 0 || confirming || scanning}
                    onClick={handleClear}
                    startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                    sx={{ minHeight: 44, px: 2.5, fontWeight: 700 }}
                  >
                    เคลียร์
                  </Button>
                </Stack>
              </Stack>

              {renderStatusChips}
              {renderTagList}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5} sx={fit ? { height: 1 } : undefined}>
          <Stack spacing={fit ? 2 : 2.5} sx={{ height: 1 }}>
            {renderHero}

            {notInLot && (
              <Alert severity="warning" sx={{ flexShrink: 0 }}>
                “{category.name}” ไม่อยู่ในล็อต {lot.lot_code} — ลงทะเบียนได้
                ระบบจะเพิ่มประเภทนี้เข้าล็อตให้อัตโนมัติ
              </Alert>
            )}

            {overQuota > 0 && (
              <Alert severity="warning" sx={{ flexShrink: 0 }}>
                เกินจำนวนสั่งซื้อในล็อต {overQuota.toLocaleString('th-TH')} ชิ้น — ยังลงทะเบียนได้
              </Alert>
            )}

            {lastResult && (
              <Alert
                severity="success"
                sx={{ flexShrink: 0 }}
                action={
                  <Button color="inherit" size="small" onClick={onOpenHistory}>
                    ดูประวัติ
                  </Button>
                }
              >
                ล่าสุด {fTime(lastResult.at)} · {lastResult.title} ·{' '}
                {lastResult.createdCount.toLocaleString('th-TH')} ชิ้น
                {lastResult.skippedCount > 0 ? ` (ข้ามซ้ำ ${lastResult.skippedCount})` : ''}
              </Alert>
            )}

            {renderConfirm}
          </Stack>
        </Grid>
      </Grid>

      <RegisterManualDialog
        open={manualDialog.value}
        onClose={manualDialog.onFalse}
        onAdd={handleManualAdd}
      />
    </>
  );
}
