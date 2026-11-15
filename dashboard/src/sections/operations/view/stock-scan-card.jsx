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
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useEpcLookup } from 'src/hooks/use-epc-lookup';
import { useFitViewport } from 'src/hooks/use-fit-viewport';

import { bgGradient } from 'src/theme/styles';
import { useGetDevices } from 'src/actions/devices';
import { scanCheckpoint } from 'src/actions/rfidReader';
import { stockScan as stockScanAction } from 'src/actions/scans';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { TagLookupLabel } from './scanned-tag-label';
import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

// สถานะที่ถือว่า "อยู่ระหว่างซัก/อบ/พับ" ก่อนเข้าสต๊อคกลาง — ตรงกับ PRE_STOCK_STATUSES ฝั่ง server
// (stockScan.controller.js) แท็กที่สถานะไม่ตรงตอนสแกนถือว่า "ข้ามขั้นตอน" ระบายสีแดงเตือนไว้ก่อนยืนยัน
const STOCK_SCAN_EXPECTED_STATUSES = ['WASH'];

// แท็กขึ้นทันที (สีปกติ = รอตรวจ) แล้วค่อยสลับสีเมื่อผลตรวจเป็นก้อนกลับมา (useEpcLookup)
// แท็กที่ไม่พบในระบบ: ไม่นับเข้ายอดยืนยัน (server ข้ามอยู่แล้ว) และแตะเลือกไม่ได้
const isStockStepSkipped = (entry) =>
  entry?.state === 'found' && !STOCK_SCAN_EXPECTED_STATUSES.includes(entry.item.status);

const StockTagChip = memo(({ tag, entry, onToggle }) => {
  const isStepSkipped = isStockStepSkipped(entry);
  const notFound = entry?.state === 'notFound';
  const selected = tag.selected && !notFound;

  return (
    <Chip
      clickable={!notFound}
      size="small"
      label={<TagLookupLabel epc={tag.epc} entry={entry} />}
      onClick={notFound ? undefined : () => onToggle(tag.epc)}
      color={notFound ? 'warning' : isStepSkipped ? 'error' : selected ? 'primary' : 'default'}
      variant={selected || isStepSkipped ? 'filled' : 'outlined'}
      icon={selected ? <Iconify icon="eva:checkmark-fill" width={16} /> : undefined}
    />
  );
});

// โหมดพอดีจอ (จอ md ขึ้นไป เช่น จอทัชที่จุดสแกน) แบบเดียวกับหน้ารับผ้าหลังซัก: ทั้งแท็บสูงพอดีจอ
// ล็อกไม่ให้ทั้งหน้าเลื่อน เลื่อนได้เฉพาะในกล่องรายการแท็ก — จอเล็ก/เตี้ยมาก กลับไปเลื่อนทั้งหน้าตามปกติ
const BIG_NUMBER_FIT = 'clamp(64px, 18vh, 168px)';

// สแกนเข้าสต๊อค — ใช้เครื่องอ่าน RFID จุดตรวจสอบตัวเดียวกับตอนลงทะเบียนผ้าใหม่ (ดู
// checkpoint-scan-card.jsx) ต่างกันที่หน้านี้เน้นตัวเลขจำนวนที่สแกนได้ใหญ่ๆ ให้รีเช็คไว ๆ ว่า
// แท็กที่ถืออยู่ในมือ (ปกติ ~4-5 ชิ้น/ครั้ง) อ่านครบตามจำนวนจริงก่อนยืนยันเข้าสต๊อคกลาง
export function StockScanCard({ hospitalId, onConfirmed }) {
  const theme = useTheme();
  const { devices } = useGetDevices(hospitalId, 'RFID_CHECKPOINT');

  const [deviceId, setDeviceId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // เลือกเครื่องอ่านที่ตั้งเป็น "ค่าเริ่มต้น" ของจุดนี้ให้อัตโนมัติ (ตั้งในหน้า "อุปกรณ์ & สัญญาณ RFID")
  useEffect(() => {
    if (deviceId) return;
    const preset = devices.find((d) => (d.default_scan_points ?? []).includes('STOCK_SCAN'));
    if (preset) setDeviceId(preset.id);
  }, [devices, deviceId]);
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
  const selectedEpcs = useMemo(
    () =>
      tagList
        .filter((tag) => tag.selected && lookup.results[tag.epc]?.state !== 'notFound')
        .map((tag) => tag.epc),
    [tagList, lookup.results]
  );
  const stepSkippedCount = useMemo(
    () => selectedEpcs.filter((epc) => isStockStepSkipped(lookup.results[epc])).length,
    [selectedEpcs, lookup.results]
  );

  const handleConfirm = useCallback(async () => {
    if (selectedEpcs.length === 0) {
      toast.error('เลือกแท็กที่จะยืนยันเข้าสต๊อคก่อน');
      return;
    }
    if (!lookup.ready) {
      toast.error('รอตรวจสอบแท็กกับระบบให้ครบก่อนยืนยัน');
      return;
    }
    setConfirming(true);
    try {
      const result = await stockScanAction({
        epcCodes: selectedEpcs,
        deviceId: deviceId ? Number(deviceId) : undefined,
      });
      toast.success(
        `ยืนยันเข้าสต๊อคกลางสำเร็จ ${result.processed.length} ชิ้น${
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
  }, [selectedEpcs, deviceId, onConfirmed, lookup.ready]);

  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { ref: fitRef, height: fitHeight } = useFitViewport({ enabled: isDesktop });
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
          <CardHeader
            avatar={<SectionAvatar icon="solar:radar-2-bold-duotone" color="primary" />}
            title="สแกนเข้าสต๊อค"
            subheader={
              fit
                ? null
                : 'สแกนผ้าที่ซัก/อบ/พับเสร็จผ่านเครื่องอ่าน RFID จุดตรวจสอบเป็นชุด (~4-5 ชิ้น/ครั้ง)'
            }
            sx={fit ? { pt: 2, pb: 0 } : undefined}
            action={
              devices.length > 0 ? (
                <TextField
                  select
                  size="small"
                  label="เครื่องอ่าน"
                  value={deviceId}
                  disabled={!hospitalId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  sx={{ minWidth: 160, maxWidth: 220 }}
                >
                  {devices.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {`#${d.id} ${d.ip_address ? `(${d.ip_address}:${d.port})` : ''}`}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null
            }
          />
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
                ต้องเพิ่มในหน้า &ldquo;อุปกรณ์ & สัญญาณ RFID&rdquo; ก่อน (ระบุ IP/Port
                ของเครื่องอ่าน)
              </Alert>
            )}

            <LoadingButton
              fullWidth
              type="button"
              size="large"
              variant="contained"
              loading={scanning}
              disabled={!deviceId}
              onClick={handleScan}
              startIcon={<Iconify icon="solar:radar-2-bold-duotone" width={30} />}
              sx={{
                flexShrink: 0,
                py: fit ? 1.5 : 2.25,
                fontSize: 22,
                fontWeight: 700,
                minHeight: fit ? 64 : 72,
              }}
            >
              สแกน
            </LoadingButton>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ flexShrink: 0 }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                รายการแท็กที่พบ
                {tagList.length > 0 ? ` (${tagList.length}) — แตะเพื่อเลือก/ยกเลิก` : ''}
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
                {lookup.notFoundCount > 0 && (
                  <Chip
                    size="small"
                    variant="soft"
                    color="warning"
                    label={`ไม่พบในระบบ ${lookup.notFoundCount} (ไม่นับเข้ายอด)`}
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
              {tagList.length === 0 ? (
                <EmptyContent
                  title="ยังไม่พบแท็ก"
                  description="เลือกเครื่องอ่านแล้วกด “สแกน” เพื่อเริ่มอ่านแท็กในระยะสัญญาณ"
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
                  {tagList.map((tag) => (
                    <StockTagChip
                      key={tag.epc}
                      tag={tag}
                      entry={lookup.results[tag.epc]}
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
                color: `to bottom, ${theme.vars.palette.success.dark} 0%, ${theme.vars.palette.success.darker} 100%`,
              }),
              ...(fit ? { flex: '1 1 0', minHeight: 0 } : { flexGrow: 1 }),
            }}
          >
            <Iconify
              icon="solar:box-bold-duotone"
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
                จำนวนที่จะยืนยันเข้าสต๊อค
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
                {tagList.length !== selectedEpcs.length
                  ? ` · พบทั้งหมด ${tagList.length} ชิ้น`
                  : ''}
              </Typography>
            </CardContent>
          </Card>

          <LoadingButton
            fullWidth
            type="button"
            size="large"
            variant="contained"
            color="success"
            loading={confirming}
            disabled={selectedEpcs.length === 0 || !lookup.ready}
            onClick={handleConfirm}
            startIcon={<Iconify icon="solar:check-read-bold-duotone" width={26} />}
            sx={{
              flexShrink: 0,
              py: fit ? 1.5 : 1.75,
              fontSize: 18,
              fontWeight: 700,
              minHeight: 60,
            }}
          >
            {tagList.length > 0 && lookup.pendingCount > 0
              ? `กำลังตรวจสอบแท็ก… (เหลือ ${lookup.pendingCount})`
              : tagList.length > 0 && lookup.failedCount > 0
                ? 'ตรวจแท็กไม่ครบ — ลองใหม่ก่อนยืนยัน'
                : 'ยืนยันเข้าสต๊อคกลาง'}
          </LoadingButton>
        </Stack>
      </Grid>
    </Grid>
  );
}
