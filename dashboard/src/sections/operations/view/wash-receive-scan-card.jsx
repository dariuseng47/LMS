'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Accordion from '@mui/material/Accordion';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import useMediaQuery from '@mui/material/useMediaQuery';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';

import { useAutoScan } from 'src/hooks/use-auto-scan';
import { useFitViewport } from 'src/hooks/use-fit-viewport';
import { usePermission } from 'src/hooks/use-has-permission';

import { bgGradient } from 'src/theme/styles';
import { useGetDevices } from 'src/actions/devices';
import { scanCheckpoint } from 'src/actions/rfidReader';
import { washReceiveBatchScan } from 'src/actions/scans';
import { useGetFabricItemDetail } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { ScannedTagLabel } from './scanned-tag-label';
import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

// สแกน RFID ที่ประตูชั่งน้ำหนัก: server ต่อเข้าไปอ่านแท็กจากเครื่อง (device_type = WEIGHT_GATE ที่ตั้ง
// IP/Port ไว้) เติมเข้าช่องรหัส EPC — หรือกรอกเองก็ได้ ส่วนน้ำหนักยังกรอกมือ (เซนเซอร์ชั่งยังไม่เชื่อม)
// contract ของ endpoint ไม่เปลี่ยน (ดู scans.controller.js#washReceiveBatch)
// สถานะที่ถือว่ามาจาก "ใช้งานที่วอร์ด" ก่อนรับกลับมาซัก — ตรงกับเงื่อนไข isStepSkipped ฝั่ง server
// (scans.controller.js#washReceiveBatch) แท็กที่สถานะไม่ตรงตอนสแกนถือว่า "ข้ามขั้นตอน" ระบายสีแดง
// เตือนไว้ก่อนยืนยัน — เพื่อความไว โชว์สีปกติไปก่อนระหว่างรอผล lazy-load แล้วค่อยสลับเป็นแดงทีหลัง
const WASH_RECEIVE_EXPECTED_STATUSES = ['IN_USE_WARD', 'WARD_CABINET'];

function WashReceiveTagChip({ epc, hospitalId }) {
  const { fabricItem, detailLoading } = useGetFabricItemDetail(epc, hospitalId);
  const isStepSkipped =
    !detailLoading && !!fabricItem && !WASH_RECEIVE_EXPECTED_STATUSES.includes(fabricItem.status);

  return (
    <Chip
      size="small"
      variant={isStepSkipped ? 'filled' : 'soft'}
      color={isStepSkipped ? 'error' : 'default'}
      label={<ScannedTagLabel epc={epc} hospitalId={hospitalId} />}
    />
  );
}

// โหมดพอดีจอ (จอ md ขึ้นไป เช่น จอทัชที่ประตูชั่ง): ทั้งแท็บสแกนสูงเท่าพื้นที่ที่เหลือของจอพอดี
// ล็อกไม่ให้ทั้งหน้าเลื่อน (กันเผลอไถจอแล้วหน้าเลื่อนหนี) — เลื่อนได้เฉพาะในกล่องรายการแท็ก
// จอเล็ก (มือถือ) / จอเตี้ยมากจนบีบไม่ไหว -> กลับไปเลื่อนทั้งหน้าตามปกติ (ดู useFitViewport)
// ตัวเลขใหญ่ย่อตามความสูงจอ (vh) ให้การ์ดสรุปพอดีจอทุกขนาด
const BIG_NUMBER_FIT = 'clamp(40px, 9vh, 80px)';

// อ่านต่อเนื่องนานสุดเท่านี้แล้วหยุดเอง — กันเปิดค้างไว้ลืมปิด (เครื่องอ่านส่งคลื่นตลอด/ยิง server ไม่หยุด)
const MAX_CONTINUOUS_MS = 10 * 60 * 1000;

const mergeEpcRaw = (prev, epcs) =>
  [...new Set([...parseEpcCodes(prev), ...epcs.map((tag) => tag.epc)])].join('\n');

function parseEpcCodes(raw) {
  return [
    ...new Set(
      raw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

export function WashReceiveScanCard({ hospitalId, onSubmitted }) {
  const theme = useTheme();
  // เลือก/สั่งเครื่องอ่าน RFID ผูกกับสิทธิ์เมนู "อุปกรณ์ & สัญญาณ RFID" (web.devices.view)
  // ไม่ผูกกับ role แล้ว — admin ที่ถอดสิทธิ์นี้ก็สแกนไม่ได้, operator ที่เปิดสิทธิ์ให้ก็สแกนได้
  // ไม่มีสิทธิ์ = กรอกรหัส EPC เองได้ตามเดิม
  const { can } = usePermission();
  const canUseReader = can('web.devices.view');

  const { devices } = useGetDevices(canUseReader ? hospitalId : null, 'WEIGHT_GATE');

  const [epcRaw, setEpcRaw] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // เลือกเครื่องอ่านที่ตั้งเป็น "ค่าเริ่มต้น" ของจุดนี้ให้อัตโนมัติ (ตั้งในหน้า "อุปกรณ์ & สัญญาณ RFID")
  // ทำครั้งแรกที่ยังไม่ได้เลือกเท่านั้น — ผู้ใช้เปลี่ยนเป็นเครื่องอื่นเองได้
  useEffect(() => {
    if (deviceId) return;
    const preset = devices.find((d) => (d.default_scan_points ?? []).includes('WASH_RECEIVE'));
    if (preset) setDeviceId(preset.id);
  }, [devices, deviceId]);

  const epcCodes = parseEpcCodes(epcRaw);

  const handleScanFromReader = useCallback(async () => {
    if (!deviceId) {
      toast.error('เลือกเครื่องอ่าน RFID ที่ประตูชั่งก่อน');
      return;
    }
    setScanning(true);
    try {
      const { epcs } = await scanCheckpoint(Number(deviceId), hospitalId);
      setEpcRaw((prev) => mergeEpcRaw(prev, epcs));
      if (epcs.length === 0) {
        toast.error('เครื่องอ่านตอบกลับแล้ว แต่ไม่พบแท็กในระยะสัญญาณ');
      } else {
        toast.success(`สแกนพบแท็ก ${epcs.length} รายการ`);
      }
    } catch (error) {
      toast.error(
        error?.message || 'สแกนไม่สำเร็จ — ตรวจสอบว่าเครื่องอ่านเปิดอยู่และเชื่อมเครือข่ายได้'
      );
    } finally {
      setScanning(false);
    }
  }, [deviceId, hospitalId]);

  // อ่านต่อเนื่อง: ยิงสแกนวนซ้ำจนกดหยุด แท็กใหม่เข้ารายการทันที (เหมาะเข็นรถเข็นผ้าผ่าน/ทยอยวางผ้า)
  // แต่ละรอบใช้ความเร็วตามที่ตั้งในหน้าอุปกรณ์ (แนะนำ "เร็วมาก" หรือ "กำหนดเอง" เวลาต่อเสาน้อยๆ)
  const handleContinuousTags = useCallback((epcs) => setEpcRaw((prev) => mergeEpcRaw(prev, epcs)), []);
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

  const handleToggleContinuous = useCallback(() => {
    if (continuous) {
      stopContinuous();
      return;
    }
    if (!deviceId) {
      toast.error('เลือกเครื่องอ่าน RFID ที่ประตูชั่งก่อน');
      return;
    }
    startContinuous(Number(deviceId));
  }, [continuous, deviceId, startContinuous, stopContinuous]);

  // เคลียร์ชุดปัจจุบัน (รายการที่สแกน + น้ำหนัก) เริ่มชุดใหม่ — ยังไม่ได้บันทึกอะไรลงระบบ
  const handleClear = useCallback(() => {
    setEpcRaw('');
    setWeightKg('');
    toast.success('เคลียร์รายการแล้ว');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (epcCodes.length === 0) {
      toast.error('กรอกรหัส EPC อย่างน้อย 1 รายการ');
      return;
    }
    if (weightKg === '' || Number(weightKg) < 0) {
      toast.error('กรอกน้ำหนักที่ชั่งได้ (กก.)');
      return;
    }
    stopContinuous(); // หยุดอ่านก่อนบันทึก กันแท็กไหลเข้ามาหลังบันทึกชุดนี้ไปแล้ว
    setSubmitting(true);
    try {
      const result = await washReceiveBatchScan({ epcCodes, weightKg: Number(weightKg) });
      toast.success(
        `บันทึกชุดสแกน+ชั่งสำเร็จ ${result.processed.length} ชิ้น${
          result.skipped.length ? ` (ข้าม ${result.skipped.length} ชิ้น)` : ''
        }`
      );
      setEpcRaw('');
      setWeightKg('');
      onSubmitted();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epcCodes, weightKg, onSubmitted, stopContinuous]);

  const canSubmit = hospitalId && epcCodes.length > 0 && weightKg !== '' && Number(weightKg) >= 0;

  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { ref: fitRef, height: fitHeight } = useFitViewport({ enabled: isDesktop });
  const fit = fitHeight !== null;

  const summaryCardSx = (color) => ({
    position: 'relative',
    overflow: 'hidden',
    color: 'common.white',
    ...bgGradient({
      color: `to bottom, ${theme.vars.palette[color].dark} 0%, ${theme.vars.palette[color].darker} 100%`,
    }),
    ...(fit && { flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }),
  });
  const summaryContentSx = {
    position: 'relative',
    textAlign: 'center',
    ...(fit && {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      py: '12px !important',
    }),
  };
  const summaryLabelSx = {
    opacity: 0.9,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontSize: 14,
  };
  const bigNumberSx = {
    lineHeight: 1,
    fontWeight: 700,
    fontSize: fit ? BIG_NUMBER_FIT : { xs: 72, sm: 80 },
  };

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
            avatar={<SectionAvatar icon="solar:scale-bold-duotone" color="primary" />}
            title="สแกน + ชั่งน้ำหนัก 1 ชุด"
            subheader={
              fit ? null : 'สแกนแท็กจากเครื่องอ่านที่ประตูชั่ง (หรือกรอกรหัส EPC เอง) แล้วดูสรุปทางขวา'
            }
            sx={fit ? { pt: 2, pb: 0 } : undefined}
            action={
              canUseReader && devices.length > 0 ? (
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
            {canUseReader && devices.length === 0 && (
              <Alert
                severity="info"
                icon={<Iconify icon="solar:info-circle-bold-duotone" />}
                sx={{ flexShrink: 0 }}
              >
                ยังไม่มีเครื่องอ่าน RFID ประเภท &ldquo;ประตูชั่งน้ำหนัก&rdquo; ที่ตั้ง IP/Port ไว้ —
                เพิ่มได้ในหน้า &ldquo;อุปกรณ์ & สัญญาณ RFID&rdquo; หรือกรอกรหัส EPC ด้วยมือไปก่อน
              </Alert>
            )}

            {canUseReader && (
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
                      animation: 'washReceivePulse 1.6s ease-in-out infinite',
                      '@keyframes washReceivePulse': {
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
                  onClick={handleScanFromReader}
                  sx={{ flexShrink: 0, minHeight: fit ? 64 : 72, px: 2.5, fontWeight: 700, fontSize: 16 }}
                >
                  อ่านครั้งเดียว
                </LoadingButton>
              </Stack>
            )}

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexShrink: 0 }}>
              <Typography variant="subtitle2" color="text.secondary">
                รายการที่สแกนได้{epcCodes.length > 0 ? ` (${epcCodes.length})` : ''}
              </Typography>
              <Button
                color="error"
                variant="outlined"
                disabled={(epcCodes.length === 0 && weightKg === '') || submitting || scanning}
                onClick={handleClear}
                startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                sx={{ minHeight: 44, px: 2.5, fontWeight: 700 }}
              >
                เคลียร์
              </Button>
            </Stack>

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
              {epcCodes.length === 0 ? (
                <EmptyContent
                  title="ยังไม่พบรหัส"
                  description={
                    canUseReader
                      ? continuous
                        ? 'กำลังอ่าน… วางผ้า/เข็นรถผ่านเครื่องอ่านได้เลย แท็กที่เจอจะขึ้นที่นี่'
                        : 'กด “เริ่มอ่านต่อเนื่อง” เพื่อเริ่มอ่านแท็ก หรือพิมพ์รหัสเองด้านล่าง'
                      : 'พิมพ์หรือวางรหัส EPC ด้านล่างเพื่อเริ่ม'
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
                  {epcCodes.map((code) => (
                    <WashReceiveTagChip key={code} epc={code} hospitalId={hospitalId} />
                  ))}
                </Box>
              )}
            </Box>

            <Accordion
              defaultExpanded={!canUseReader}
              disableGutters
              sx={{
                flexShrink: 0,
                boxShadow: 'none',
                bgcolor: 'transparent',
                border: (t) => `1px dashed ${t.vars.palette.divider}`,
                borderRadius: 1.5,
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary
                expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}
                sx={fit ? { minHeight: 44 } : undefined}
              >
                <Typography variant="body2" color="text.secondary">
                  พิมพ์หรือวางรหัส EPC เอง
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  fullWidth
                  multiline
                  rows={fit ? 3 : 5}
                  placeholder={'วางหรือพิมพ์รหัส EPC\n1 รายการต่อบรรทัด หรือคั่นด้วย comma'}
                  value={epcRaw}
                  disabled={!hospitalId}
                  onChange={(e) => setEpcRaw(e.target.value)}
                  slotProps={{ htmlInput: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
                />
              </AccordionDetails>
            </Accordion>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={5} sx={fit ? { height: 1 } : undefined}>
        <Stack spacing={fit ? 2 : 2.5} sx={{ height: 1 }}>
          <Card sx={summaryCardSx('primary')}>
            <Iconify
              icon="solar:qr-code-bold-duotone"
              width={140}
              sx={{ position: 'absolute', right: -24, bottom: -28, opacity: 0.14 }}
            />
            <CardContent sx={summaryContentSx}>
              <Typography sx={summaryLabelSx}>รหัสที่พบ</Typography>
              <Typography sx={bigNumberSx}>{epcCodes.length}</Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                รายการ
              </Typography>
            </CardContent>
          </Card>

          <Card sx={summaryCardSx('warning')}>
            <Iconify
              icon="solar:scale-bold-duotone"
              width={140}
              sx={{ position: 'absolute', right: -24, bottom: -28, opacity: 0.14 }}
            />
            <CardContent sx={summaryContentSx}>
              <Typography sx={summaryLabelSx}>น้ำหนักที่ชั่งได้</Typography>
              <Typography sx={bigNumberSx}>{weightKg === '' ? '0' : weightKg}</Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9, mb: fit ? 1.5 : 2.5 }}>
                กก.
              </Typography>

              <TextField
                type="number"
                value={weightKg}
                disabled={!hospitalId}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="กรอกน้ำหนักที่ชั่งได้"
                sx={{
                  mx: 'auto',
                  maxWidth: 240,
                  bgcolor: 'common.white',
                  borderRadius: 1,
                }}
                slotProps={{
                  htmlInput: {
                    min: 0,
                    step: 0.1,
                    inputMode: 'decimal', // จอทัช: เปิดแป้นตัวเลขแทนคีย์บอร์ดเต็ม
                    style: { textAlign: 'center' },
                  },
                }}
              />
            </CardContent>
          </Card>

          {!fit && <Box sx={{ flexGrow: 1 }} />}

          <LoadingButton
            fullWidth
            type="button"
            size="large"
            variant="contained"
            loading={submitting}
            disabled={!canSubmit}
            onClick={handleSubmit}
            startIcon={<Iconify icon="solar:check-read-bold-duotone" width={26} />}
            sx={{ flexShrink: 0, py: fit ? 1.5 : 1.75, fontSize: 18, fontWeight: 700, minHeight: 60 }}
          >
            บันทึกชุดนี้
          </LoadingButton>
        </Stack>
      </Grid>
    </Grid>
  );
}
