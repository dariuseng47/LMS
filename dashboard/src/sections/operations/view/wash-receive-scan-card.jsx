'use client';

import { useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import InputAdornment from '@mui/material/InputAdornment';

import { washReceiveBatchScan } from 'src/actions/scans';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// สแกน RFID จริงที่ประตูชั่งน้ำหนัก + เซนเซอร์ชั่งน้ำหนักยังไม่เชื่อมฮาร์ดแวร์ — การ์ดนี้จึงให้กรอกรหัส
// EPC (คั่นด้วยขึ้นบรรทัดใหม่หรือ comma) และน้ำหนักเองแทนไปก่อน ค่อยเปลี่ยนมาอ่านจากอุปกรณ์จริงทีหลัง
// โดยไม่ต้องแก้ contract ของ endpoint (ดู scans.controller.js#washReceiveBatch)
function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
}

export function WashReceiveScanCard({ hospitalId, onSubmitted }) {
  const [epcRaw, setEpcRaw] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const epcCodes = parseEpcCodes(epcRaw);

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

  return (
    <Card>
      <CardHeader
        title="สแกน + ชั่งน้ำหนัก 1 ชุด"
        subheader="จุดอ่าน RFID ที่ประตูชั่งน้ำหนักยังไม่เชื่อมฮาร์ดแวร์จริง — กรอกรหัส EPC และน้ำหนักที่ชั่งได้เองไปก่อน"
      />
      <CardContent>
        <Stack spacing={2.5}>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="รหัส EPC (1 รายการต่อบรรทัด หรือคั่นด้วย comma)"
            value={epcRaw}
            disabled={!hospitalId}
            onChange={(e) => setEpcRaw(e.target.value)}
            helperText={`พบ ${epcCodes.length} รายการ`}
          />

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
            sx={{ maxWidth: 240 }}
          />

          <LoadingButton
            type="button"
            variant="contained"
            loading={submitting}
            disabled={!hospitalId}
            onClick={handleSubmit}
            startIcon={<Iconify icon="solar:scale-bold-duotone" />}
            sx={{ alignSelf: 'flex-start' }}
          >
            บันทึกชุดนี้
          </LoadingButton>
        </Stack>
      </CardContent>
    </Card>
  );
}
