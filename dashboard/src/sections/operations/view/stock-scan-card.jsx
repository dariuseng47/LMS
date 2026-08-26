'use client';

import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useGetDevices } from 'src/actions/devices';
import { scanCheckpoint } from 'src/actions/rfidReader';
import { stockScan as stockScanAction } from 'src/actions/scans';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// สแกนเข้าสต๊อค — ใช้เครื่องอ่าน RFID จุดตรวจสอบตัวเดียวกับตอนลงทะเบียนผ้าใหม่ (ดู
// checkpoint-scan-card.jsx) ต่างกันที่หน้านี้เน้นตัวเลขจำนวนที่สแกนได้ใหญ่ๆ ให้รีเช็คไว ๆ ว่า
// แท็กที่ถืออยู่ในมือ (ปกติ ~4-5 ชิ้น/ครั้ง) อ่านครบตามจำนวนจริงก่อนยืนยันเข้าสต๊อคกลาง
export function StockScanCard({ hospitalId, onConfirmed }) {
  const { devices } = useGetDevices(hospitalId, 'RFID_CHECKPOINT');

  const [deviceId, setDeviceId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
      toast.error(error?.message || 'สแกนไม่สำเร็จ — ตรวจสอบว่าเครื่องอ่านเปิดอยู่และเชื่อมเครือข่ายได้');
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
  const selectedEpcs = useMemo(
    () => tagList.filter((tag) => tag.selected).map((tag) => tag.epc),
    [tagList]
  );

  const handleConfirm = useCallback(async () => {
    if (selectedEpcs.length === 0) {
      toast.error('เลือกแท็กที่จะยืนยันเข้าสต๊อคก่อน');
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
  }, [selectedEpcs, deviceId, onConfirmed]);

  return (
    <Card>
      <CardHeader
        title="สแกนเข้าสต๊อค"
        subheader="สแกนผ้าที่ซัก/อบ/พับเสร็จผ่านเครื่องอ่าน RFID จุดตรวจสอบเป็นชุด (~4-5 ชิ้น/ครั้ง) เพื่อรีเช็คจำนวนก่อนเข้าสต๊อคกลาง"
      />
      <CardContent>
        <Stack spacing={2.5}>
          {devices.length === 0 && (
            <Typography variant="caption" sx={{ color: 'warning.main' }}>
              ยังไม่มีเครื่องอ่าน RFID ประเภท &ldquo;จุดตรวจสอบ&rdquo; ที่ผูกกับโรงพยาบาลนี้ — ต้องเพิ่มในหน้า
              &ldquo;อุปกรณ์ & สัญญาณ RFID&rdquo; ก่อน (ระบุ IP/Port ของเครื่องอ่าน)
            </Typography>
          )}

          <TextField
            select
            fullWidth
            size="small"
            label="เครื่องอ่าน RFID"
            value={deviceId}
            disabled={!hospitalId}
            onChange={(event) => setDeviceId(event.target.value)}
            sx={{ maxWidth: 360 }}
          >
            {devices.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {`#${d.id} ${d.ip_address ? `(${d.ip_address}:${d.port})` : ''}`}
              </MenuItem>
            ))}
          </TextField>

          <LoadingButton
            type="button"
            variant="contained"
            loading={scanning}
            disabled={!deviceId}
            onClick={handleScan}
            startIcon={<Iconify icon="solar:radar-2-bold-duotone" />}
            sx={{ alignSelf: 'flex-start' }}
          >
            สแกนตอนนี้
          </LoadingButton>

          <Box
            sx={{
              py: 4,
              textAlign: 'center',
              borderRadius: 2,
              bgcolor: 'background.neutral',
            }}
          >
            <Typography sx={{ typography: 'h1', lineHeight: 1, color: 'primary.main' }}>
              {selectedEpcs.length}
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'text.secondary', mt: 1 }}>
              ชิ้นที่จะยืนยันเข้าสต๊อค{tagList.length !== selectedEpcs.length ? ` (พบทั้งหมด ${tagList.length})` : ''}
            </Typography>
          </Box>

          {tagList.length > 0 && (
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2">รายการแท็กที่พบ</Typography>
                <Button size="small" color="inherit" onClick={handleClear}>
                  ล้างรายการ
                </Button>
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {tagList.map((tag) => (
                  <FormControlLabel
                    key={tag.epc}
                    control={
                      <Checkbox
                        size="small"
                        checked={tag.selected}
                        onChange={() => handleToggleTag(tag.epc)}
                      />
                    }
                    label={<Chip size="small" label={tag.epc} />}
                    sx={{ mr: 0 }}
                  />
                ))}
              </Stack>
            </Stack>
          )}

          <LoadingButton
            type="button"
            variant="contained"
            color="success"
            size="large"
            loading={confirming}
            disabled={selectedEpcs.length === 0}
            onClick={handleConfirm}
            sx={{ alignSelf: 'flex-start' }}
          >
            ยืนยันเข้าสต๊อคกลาง ({selectedEpcs.length} ชิ้น)
          </LoadingButton>
        </Stack>
      </CardContent>
    </Card>
  );
}
