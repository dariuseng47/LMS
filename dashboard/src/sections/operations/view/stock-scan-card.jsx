'use client';

import { memo, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useAutoScan } from 'src/hooks/use-auto-scan';
import { useEpcLookup } from 'src/hooks/use-epc-lookup';
import { useFitViewport } from 'src/hooks/use-fit-viewport';

import { bgGradient } from 'src/theme/styles';
import { scanCheckpoint } from 'src/actions/rfidReader';
import { stockScan as stockScanAction } from 'src/actions/scans';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { TagLookupLabel } from './scanned-tag-label';
import { SectionAvatar } from './restock-section-avatar';
import { ReaderNotSelectedAlert } from './scan-reader-tab';
import { NotFoundTagsButton } from './not-found-tags-button';
import {
  STATUS_LABEL,
  STOCK_OPTIONS,
  stockOptionOf,
  stockScanExpectedStatuses,
} from '../../fabric/fabric-constants';

// ----------------------------------------------------------------------

// แท็กที่สถานะไม่อยู่ใน stockScanExpectedStatuses ของสต๊อคที่เลือก ถือว่า "ข้ามขั้นตอน" ระบายสีแดงเตือนไว้ก่อนยืนยัน
// แท็กขึ้นทันที (สีปกติ = รอตรวจ) แล้วค่อยสลับสีเมื่อผลตรวจเป็นก้อนกลับมา (useEpcLookup)
// แท็กที่ไม่พบในระบบ: ไม่แสดงในรายการ ไม่นับเข้ายอดยืนยัน — ดูผ่านปุ่ม "ไม่พบในระบบ"
const isStockStepSkipped = (entry, stockType) =>
  entry?.state === 'found' && !stockScanExpectedStatuses(stockType).includes(entry.item.status);

const STOCK_VALUES = STOCK_OPTIONS.map((option) => option.value);
// อยู่อีกสต๊อคหนึ่งอยู่แล้ว -> รอบนี้คือการย้ายสต๊อค
const isMovingStock = (entry, stockType) =>
  entry?.state === 'found' &&
  entry.item.status !== stockType &&
  STOCK_VALUES.includes(entry.item.status);

const StockTagChip = memo(({ tag, entry, stockType, onToggle }) => {
  const isStepSkipped = isStockStepSkipped(entry, stockType);
  const { selected } = tag;

  return (
    <Chip
      clickable
      size="small"
      label={<TagLookupLabel epc={tag.epc} entry={entry} />}
      onClick={() => onToggle(tag.epc)}
      color={isStepSkipped ? 'error' : selected ? 'primary' : 'default'}
      variant={selected || isStepSkipped ? 'filled' : 'outlined'}
      icon={selected ? <Iconify icon="eva:checkmark-fill" width={16} /> : undefined}
    />
  );
});

// ปุ่มยืนยันของสต๊อคที่ตั้ง blink ไว้ (จ่ายกลาง) กระพริบเขียว-เหลืองตอนกดได้ ให้รู้ตัวว่าไม่ได้กำลังเข้าสต๊อกกลาง
// ตัวหนังสือสีเข้มคงที่ อ่านออกทั้งสองสี / รอบละ 1.2 วิ ไม่ถี่จนแสบตา / ผู้ใช้ที่ปิดแอนิเมชันในเครื่องจะไม่กระพริบ
const BLINK_SX = {
  color: 'grey.900',
  bgcolor: 'success.main',
  animation: 'stockConfirmBlink 1.2s ease-in-out infinite',
  '@keyframes stockConfirmBlink': {
    '0%, 100%': { backgroundColor: '#22C55E' },
    '50%': { backgroundColor: '#FFD600' },
  },
  '&:hover': { bgcolor: 'success.main' },
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
};

// โหมดพอดีจอ (จอ md ขึ้นไป เช่น จอทัชที่จุดสแกน) แบบเดียวกับหน้ารับผ้าหลังซัก: ทั้งแท็บสูงพอดีจอ
// ล็อกไม่ให้ทั้งหน้าเลื่อน เลื่อนได้เฉพาะในกล่องรายการแท็ก — จอเล็ก/เตี้ยมาก กลับไปเลื่อนทั้งหน้าตามปกติ
const BIG_NUMBER_FIT = 'clamp(64px, 18vh, 168px)';

// อ่านต่อเนื่องนานสุดเท่านี้แล้วหยุดเอง (แบบหน้ารับผ้าหลังซัก) กันลืมเปิดเครื่องอ่านทิ้งไว้
const MAX_CONTINUOUS_MS = 10 * 60 * 1000;

// สแกนเข้าสต๊อค — ใช้เครื่องอ่าน RFID จุดตรวจสอบตัวเดียวกับตอนลงทะเบียนผ้าใหม่ (ดู
// register-scan-card.jsx) ต่างกันที่หน้านี้เน้นตัวเลขจำนวนที่สแกนได้ใหญ่ๆ ให้รีเช็คไว ๆ ว่า
// แท็กที่ถืออยู่ในมือ (ปกติ ~4-5 ชิ้น/ครั้ง) อ่านครบตามจำนวนจริงก่อนยืนยันเข้าสต๊อคที่เลือก (สต๊อกกลาง/จ่ายกลาง)
// reader = ผลจาก useScanReader (เลือกเครื่องอ่านในแท็บ "เครื่องอ่าน") | active = แท็บสแกนเปิดอยู่ (สลับแท็บแล้ว
// การ์ดแค่ถูกซ่อน รายการที่สแกนไว้ไม่หาย)
export function StockScanCard({ hospitalId, reader, active, onOpenReader, onConfirmed }) {
  const theme = useTheme();
  const { devices, devicesLoading, deviceId } = reader;

  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // สต๊อคปลายทาง — เปิดหน้าใหม่เริ่มที่สต๊อกกลางเสมอ ยืนยันแล้วคงค่าไว้ให้สแกนชุดถัดไปต่อได้เลย
  const [stockType, setStockType] = useState(STOCK_OPTIONS[0].value);
  const stockLabel = STATUS_LABEL[stockType];
  const stockOption = stockOptionOf(stockType);

  // Map<epc, { epc, rssi, selected }> — สะสมผลไว้ถ้ากดสแกนซ้ำหลายรอบก่อนยืนยัน
  const [foundTags, setFoundTags] = useState(new Map());

  const handleScan = useCallback(async () => {
    if (!deviceId) {
      toast.error('เลือกเครื่องอ่าน RFID ก่อน');
      return;
    }
    setScanning(true);
    try {
      const { epcs } = await scanCheckpoint(Number(deviceId), hospitalId);
      setFoundTags((prev) => {
        const next = new Map(prev);
        epcs.forEach((tag) => next.set(tag.epc, { ...tag, selected: true }));
        return next;
      });
      if (epcs.length === 0) toast.error('ไม่พบแท็กในระยะสัญญาณ');
    } catch (error) {
      toast.error(
        error?.message || 'สแกนไม่สำเร็จ — ตรวจสอบว่าเครื่องอ่านเปิดอยู่และเชื่อมเครือข่ายได้'
      );
    } finally {
      setScanning(false);
    }
  }, [deviceId, hospitalId]);

  // อ่านต่อเนื่อง: ยิงสแกนวนซ้ำจนกดหยุด แท็กใหม่เข้ารายการทันที — แท็กที่มีอยู่แล้วไม่แตะต้อง
  // (แท็กที่ผู้ใช้แตะยกเลิกไว้ต้องไม่ถูกเลือกกลับมาเองเมื่อเครื่องอ่านเจอซ้ำในรอบถัดไป)
  const handleContinuousTags = useCallback((epcs) => {
    setFoundTags((prev) => {
      const fresh = epcs.filter((tag) => !prev.has(tag.epc));
      if (fresh.length === 0) return prev;
      const next = new Map(prev);
      fresh.forEach((tag) => next.set(tag.epc, { ...tag, selected: true }));
      return next;
    });
  }, []);
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

  const handleToggleTag = useCallback((epc) => {
    setFoundTags((prev) => {
      const next = new Map(prev);
      const tag = next.get(epc);
      if (tag) next.set(epc, { ...tag, selected: !tag.selected });
      return next;
    });
  }, []);

  const handleClear = useCallback(() => setFoundTags(new Map()), []);

  const tagList = useMemo(() => [...foundTags.values()], [foundTags]);
  const tagEpcs = useMemo(() => tagList.map((tag) => tag.epc), [tagList]);
  const lookup = useEpcLookup(tagEpcs, hospitalId);
  const { notFoundEpcs } = lookup;
  const listedTags = useMemo(
    () => lookup.listedEpcs.map((epc) => foundTags.get(epc)),
    [lookup.listedEpcs, foundTags]
  );
  const selectedEpcs = useMemo(
    () => listedTags.filter((tag) => tag.selected).map((tag) => tag.epc),
    [listedTags]
  );
  const stepSkippedCount = useMemo(
    () => selectedEpcs.filter((epc) => isStockStepSkipped(lookup.results[epc], stockType)).length,
    [selectedEpcs, lookup.results, stockType]
  );
  const movingStockCount = useMemo(
    () => selectedEpcs.filter((epc) => isMovingStock(lookup.results[epc], stockType)).length,
    [selectedEpcs, lookup.results, stockType]
  );

  const canConfirm = selectedEpcs.length > 0 && lookup.ready;

  const handleConfirm = useCallback(async () => {
    if (selectedEpcs.length === 0) {
      toast.error('เลือกแท็กที่จะยืนยันเข้าสต๊อคก่อน');
      return;
    }
    if (!lookup.ready) {
      toast.error('รอตรวจสอบแท็กกับระบบให้ครบก่อนยืนยัน');
      return;
    }
    stopContinuous(); // หยุดอ่านก่อนยืนยัน กันแท็กไหลเข้ามาหลังยืนยันชุดนี้ไปแล้ว
    setConfirming(true);
    try {
      const result = await stockScanAction(
        {
          epcCodes: selectedEpcs,
          deviceId: deviceId ? Number(deviceId) : undefined,
          stockType,
        },
        hospitalId
      );
      // ใช้สต๊อคที่ server บันทึกจริง (ไม่ใช่ที่เลือก) — server เวอร์ชันเก่าไม่รู้จัก stockType จะบันทึกเป็นสต๊อกกลาง
      const savedStock = result.stockType ?? 'CENTRAL_STOCK';
      if (savedStock !== stockType) {
        toast.error(
          `บันทึกเป็น${STATUS_LABEL[savedStock]}แทน${stockLabel} — ต้องอัปเดต server ก่อนจึงใช้${stockLabel}ได้`
        );
      }
      toast.success(
        `${stockOptionOf(savedStock).confirmText}สำเร็จ ${result.processed.length} ชิ้น${
          result.skipped.length ? ` (ข้าม ${result.skipped.length} ชิ้น)` : ''
        }`
      );
      setFoundTags(new Map());
      onConfirmed();
    } catch (error) {
      toast.error(error?.message || 'ยืนยันเข้าสต๊อคไม่สำเร็จ');
    } finally {
      setConfirming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEpcs, deviceId, stockType, hospitalId, onConfirmed, stopContinuous, lookup.ready]);

  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { ref: fitRef, height: fitHeight } = useFitViewport({ enabled: isDesktop && active });
  const fit = fitHeight !== null;

  return (
    <Grid
      ref={fitRef}
      container
      spacing={fit ? 2 : 3}
      alignItems="stretch"
      sx={{
        // manipulation = ปิด double-tap zoom ของเบราว์เซอร์บนจอทัช แต่ยังปัด/ซูมสองนิ้วได้
        touchAction: 'manipulation',
        ...(fit && { height: fitHeight, overflow: 'hidden' }),
      }}
    >
      <Grid item xs={12} md={7} sx={fit ? { height: 1 } : undefined}>
        <Card sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={2}
            sx={{ px: 3, pt: fit ? 2 : 3, flexShrink: 0 }}
          >
            <Stack direction="row" spacing={2} alignItems="center" sx={{ flexShrink: 0 }}>
              <SectionAvatar icon="solar:radar-2-bold-duotone" color="primary" />
              <Typography variant="h6">สแกนเข้าสต๊อค</Typography>
            </Stack>

            {/* ใหญ่พอสำหรับจอสัมผัส ทั้งช่องเลือกและรายการที่กางออกมา */}
            <TextField
              select
              fullWidth
              label="สต๊อคที่จะสแกนเข้า"
              value={stockType}
              disabled={confirming}
              onChange={(event) => setStockType(event.target.value)}
              SelectProps={{
                SelectDisplayProps: { style: { display: 'flex', alignItems: 'center' } },
              }}
              sx={{
                '& .MuiInputBase-root': { minHeight: 64 },
                '& .MuiSelect-select': { fontSize: 20, fontWeight: 700 },
                '& .MuiSelect-icon': { width: 32, height: 32, top: 'calc(50% - 16px)' },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: 2,
                  borderColor: `${stockOption.color}.main`,
                },
              }}
            >
              {STOCK_OPTIONS.map((option) => (
                <MenuItem
                  key={option.value}
                  value={option.value}
                  // && = ชนะ min-height: auto ของ MenuItem บนจอใหญ่
                  sx={{ '&&': { minHeight: 68, fontSize: 20, fontWeight: 700 } }}
                >
                  <Iconify
                    icon={option.icon}
                    width={30}
                    sx={{ mr: 1.5, flexShrink: 0, color: `${option.color}.main` }}
                  />
                  {STATUS_LABEL[option.value]}
                </MenuItem>
              ))}
            </TextField>
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
            {!devicesLoading && devices.length === 0 && (
              <Alert
                severity="warning"
                icon={<Iconify icon="solar:danger-triangle-bold-duotone" />}
                sx={{ flexShrink: 0 }}
              >
                ยังไม่มีเครื่องอ่าน RFID ประเภท &ldquo;จุดตรวจสอบ&rdquo; ที่ผูกกับโรงพยาบาลนี้ —
                ต้องเพิ่มในหน้า &ldquo;อุปกรณ์ & สัญญาณ RFID&rdquo; ก่อน (ระบุ IP/Port
                ของเครื่องอ่าน)
              </Alert>
            )}

            <ReaderNotSelectedAlert reader={reader} onOpenReader={onOpenReader} />

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
                  py: fit ? 1.5 : 2.25,
                  fontSize: 22,
                  fontWeight: 700,
                  minHeight: fit ? 64 : 72,
                  ...(continuous && {
                    animation: 'stockScanPulse 1.6s ease-in-out infinite',
                    '@keyframes stockScanPulse': {
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
                sx={{
                  flexShrink: 0,
                  minHeight: fit ? 64 : 72,
                  px: 2.5,
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                อ่านครั้งเดียว
              </LoadingButton>
            </Stack>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ flexShrink: 0 }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                รายการแท็กที่พบ
                {listedTags.length > 0 ? ` (${listedTags.length}) — แตะเพื่อเลือก/ยกเลิก` : ''}
              </Typography>
              <Button
                color="error"
                variant="outlined"
                disabled={tagList.length === 0 || confirming || scanning}
                onClick={handleClear}
                startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                sx={{ minHeight: 44, px: 2.5, fontWeight: 700 }}
              >
                เคลียร์
              </Button>
            </Stack>

            {tagList.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ flexShrink: 0 }}>
                <Chip
                  size="small"
                  variant="soft"
                  color={lookup.pendingCount > 0 ? 'info' : 'success'}
                  icon={
                    <Iconify
                      icon={
                        lookup.pendingCount > 0
                          ? 'svg-spinners:180-ring'
                          : 'solar:check-circle-bold'
                      }
                    />
                  }
                  label={`ตรวจแล้ว ${lookup.checkedCount}/${tagList.length}`}
                />
                {notFoundEpcs.length > 0 && <NotFoundTagsButton epcs={notFoundEpcs} />}
                {movingStockCount > 0 && (
                  <Chip
                    size="small"
                    variant="soft"
                    color="secondary"
                    icon={<Iconify icon="solar:transfer-horizontal-bold" />}
                    label={`ย้ายจากอีกสต๊อค ${movingStockCount}`}
                  />
                )}
                {stepSkippedCount > 0 && (
                  <Chip
                    size="small"
                    variant="soft"
                    color="error"
                    label={`ข้ามขั้นตอน ${stepSkippedCount}`}
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
            )}

            {/* กล่องรายการ: โหมดพอดีจอ = กินพื้นที่ที่เหลือทั้งหมด แท็กเยอะก็เลื่อนในกล่องนี้ที่เดียว
                โหมดปกติ = สูงคงที่ ไม่ดันส่วนอื่นให้ขยับ */}
            <Box
              sx={{
                ...(fit ? { flex: 1, minHeight: 96 } : { height: 260 }),
                borderRadius: 1.5,
                bgcolor: 'background.neutral',
                overflowY: 'auto',
                overscrollBehavior: 'contain', // ปัดรายการจนสุดแล้วไม่ลากทั้งหน้าตาม
              }}
            >
              {listedTags.length === 0 ? (
                <EmptyContent
                  title={notFoundEpcs.length > 0 ? 'ยังไม่พบผ้าที่ลงทะเบียน' : 'ยังไม่พบแท็ก'}
                  description={
                    continuous
                      ? 'กำลังอ่าน… วางผ้าที่เครื่องอ่านได้เลย แท็กที่เจอจะขึ้นที่นี่'
                      : 'กด “เริ่มอ่านต่อเนื่อง” หรือ “อ่านครั้งเดียว” เพื่อเริ่มอ่านแท็ก'
                  }
                  sx={{ py: 2, height: 1, bgcolor: 'transparent' }}
                  slotProps={{ img: { maxWidth: fit ? 96 : 160 } }}
                />
              ) : (
                <Box
                  sx={{
                    p: 1.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignContent: 'flex-start',
                    gap: 1,
                  }}
                >
                  {listedTags.map((tag) => (
                    <StockTagChip
                      key={tag.epc}
                      tag={tag}
                      entry={lookup.results[tag.epc]}
                      stockType={stockType}
                      onToggle={handleToggleTag}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={5} sx={fit ? { height: 1 } : undefined}>
        <Stack spacing={fit ? 2 : 2.5} sx={{ height: 1 }}>
          <Card
            sx={{
              position: 'relative',
              overflow: 'hidden',
              color: 'common.white',
              ...bgGradient({
                color: `to bottom, ${theme.vars.palette[stockOption.color].dark} 0%, ${theme.vars.palette[stockOption.color].darker} 100%`,
              }),
              ...(fit ? { flex: '1 1 0', minHeight: 0 } : { flexGrow: 1 }),
            }}
          >
            <Iconify
              icon={stockOption.icon}
              width={140}
              sx={{ position: 'absolute', right: -24, bottom: -28, opacity: 0.14 }}
            />
            <CardContent
              sx={{
                height: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                position: 'relative',
                textAlign: 'center',
                ...(fit && { py: '12px !important' }),
              }}
            >
              <Typography
                sx={{
                  opacity: 0.9,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  fontSize: 14,
                }}
              >
                จำนวนที่จะ{stockOption.confirmText}
              </Typography>
              <Typography
                sx={{
                  lineHeight: 1,
                  fontWeight: 700,
                  fontSize: fit ? BIG_NUMBER_FIT : { xs: 144, sm: 168 },
                }}
              >
                {selectedEpcs.length}
              </Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                ชิ้น
                {listedTags.length !== selectedEpcs.length
                  ? ` · พบทั้งหมด ${listedTags.length} ชิ้น`
                  : ''}
              </Typography>
            </CardContent>
          </Card>

          <LoadingButton
            fullWidth
            type="button"
            size="large"
            variant="contained"
            color={stockOption.color}
            loading={confirming}
            disabled={!canConfirm}
            onClick={handleConfirm}
            startIcon={<Iconify icon="solar:check-read-bold-duotone" width={26} />}
            sx={{
              flexShrink: 0,
              py: fit ? 1.5 : 1.75,
              fontSize: 18,
              fontWeight: 700,
              minHeight: 60,
              ...(stockOption.blink && canConfirm && !confirming && BLINK_SX),
            }}
          >
            {tagList.length > 0 && lookup.pendingCount > 0
              ? `กำลังตรวจสอบแท็ก… (เหลือ ${lookup.pendingCount})`
              : tagList.length > 0 && lookup.failedCount > 0
                ? 'ตรวจแท็กไม่ครบ — ลองใหม่ก่อนยืนยัน'
                : stockOption.confirmText}
          </LoadingButton>
        </Stack>
      </Grid>
    </Grid>
  );
}
