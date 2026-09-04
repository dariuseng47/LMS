'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import InputAdornment from '@mui/material/InputAdornment';

import { usePermission } from 'src/hooks/use-has-permission';

import { bgGradient } from 'src/theme/styles';
import { useGetDevices } from 'src/actions/devices';
import { scanCheckpoint } from 'src/actions/rfidReader';
import { washReceiveBatchScan } from 'src/actions/scans';
import { useGetFabricItemDetail } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

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
      setEpcRaw((prev) => {
        const merged = [...new Set([...parseEpcCodes(prev), ...epcs.map((tag) => tag.epc)])];
        return merged.join('\n');
      });
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

  const handleSubmit = useCallback(async () => {
    if (epcCodes.length === 0) {
      toast.error('กรอกรหัส EPC อย่างน้อย 1 รายการ');
      return;
    }
    if (weightKg === '' || Number(weightKg) < 0) {
      toast.error('กรอกน้ำหนักที่ชั่งได้ (กก.)');
      return;
    }
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
  }, [epcCodes, weightKg, onSubmitted]);

  const canSubmit = hospitalId && epcCodes.length > 0 && weightKg !== '' && Number(weightKg) >= 0;

  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:scale-bold-duotone" color="primary" />}
        title="สแกน + ชั่งน้ำหนัก 1 ชุด"
        subheader="สแกนแท็กจากเครื่องอ่านที่ประตูชั่ง (หรือกรอกรหัส EPC เอง) + ใส่น้ำหนักรวม แล้วกดบันทึก"
      />
      <CardContent>
        {canUseReader && (
          <>
            {devices.length === 0 && (
              <Alert
                severity="info"
                icon={<Iconify icon="solar:info-circle-bold-duotone" />}
                sx={{ mb: 2.5 }}
              >
                ยังไม่มีเครื่องอ่าน RFID ประเภท &ldquo;ประตูชั่งน้ำหนัก&rdquo; ที่ตั้ง IP/Port ไว้ —
                เพิ่มได้ในหน้า &ldquo;อุปกรณ์ & สัญญาณ RFID&rdquo; หรือกรอกรหัส EPC ด้วยมือไปก่อน
              </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="เครื่องอ่าน RFID (ประตูชั่ง)"
                value={deviceId}
                disabled={!hospitalId || devices.length === 0}
                onChange={(event) => setDeviceId(event.target.value)}
                sx={{ maxWidth: { sm: 340 } }}
              >
                {devices.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {`#${d.id} ${d.ip_address ? `(${d.ip_address}:${d.port})` : ''}`}
                  </MenuItem>
                ))}
              </TextField>

              <LoadingButton
                type="button"
                size="large"
                variant="contained"
                loading={scanning}
                disabled={!deviceId}
                onClick={handleScanFromReader}
                startIcon={<Iconify icon="solar:radar-2-bold-duotone" width={28} />}
                sx={{ flexShrink: 0, px: 5, py: 2, fontSize: 20, fontWeight: 700, minHeight: 64 }}
              >
                สแกน
              </LoadingButton>
            </Stack>
          </>
        )}

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={7}>
            <TextField
              fullWidth
              multiline
              rows={7}
              label="รหัส EPC"
              placeholder={'วางหรือพิมพ์รหัส EPC\n1 รายการต่อบรรทัด หรือคั่นด้วย comma'}
              value={epcRaw}
              disabled={!hospitalId}
              onChange={(e) => setEpcRaw(e.target.value)}
              slotProps={{ htmlInput: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
            />
          </Grid>

          <Grid item xs={12} md={5}>
            <Stack spacing={2.5} sx={{ height: 1 }}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden',
                  textAlign: 'center',
                  color: 'common.white',
                  ...bgGradient({
                    color: `to bottom, ${theme.vars.palette.primary.dark} 0%, ${theme.vars.palette.primary.darker} 100%`,
                  }),
                }}
              >
                <Iconify
                  icon="solar:qr-code-bold-duotone"
                  width={120}
                  sx={{ position: 'absolute', right: -24, bottom: -28, opacity: 0.14 }}
                />
                <Typography
                  sx={{
                    opacity: 0.9,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    fontSize: 14,
                    position: 'relative',
                  }}
                >
                  รหัสที่พบ
                </Typography>
                <Typography
                  sx={{ lineHeight: 1, fontWeight: 700, fontSize: { xs: 64, sm: 72 }, position: 'relative' }}
                >
                  {epcCodes.length}
                </Typography>
                <Typography variant="subtitle1" sx={{ opacity: 0.9, position: 'relative' }}>
                  รายการ
                </Typography>
              </Box>

              {epcCodes.length > 0 && (
                <Box
                  sx={{
                    p: 1.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    maxHeight: 160,
                    overflowY: 'auto',
                    borderRadius: 1.5,
                    bgcolor: 'background.neutral',
                  }}
                >
                  {epcCodes.map((code) => (
                    <WashReceiveTagChip key={code} epc={code} hospitalId={hospitalId} />
                  ))}
                </Box>
              )}

              <TextField
                label="น้ำหนักที่ชั่งได้ทั้งชุด"
                type="number"
                value={weightKg}
                disabled={!hospitalId}
                onChange={(e) => setWeightKg(e.target.value)}
                slotProps={{
                  input: { endAdornment: <InputAdornment position="end">กก.</InputAdornment> },
                  htmlInput: { min: 0, step: 0.1 },
                }}
              />

              <Box sx={{ flexGrow: 1 }} />

              <LoadingButton
                fullWidth
                size="large"
                type="button"
                variant="contained"
                loading={submitting}
                disabled={!canSubmit}
                onClick={handleSubmit}
                startIcon={<Iconify icon="solar:check-read-bold-duotone" />}
              >
                บันทึกชุดนี้
              </LoadingButton>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
