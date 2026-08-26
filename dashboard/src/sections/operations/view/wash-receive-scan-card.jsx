'use client';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import InputAdornment from '@mui/material/InputAdornment';

import { washReceiveBatchScan } from 'src/actions/scans';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { SectionAvatar } from './restock-section-avatar';

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

  const canSubmit = hospitalId && epcCodes.length > 0 && weightKg !== '' && Number(weightKg) >= 0;

  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:scale-bold-duotone" color="primary" />}
        title="สแกน + ชั่งน้ำหนัก 1 ชุด"
        subheader="กรอกรหัส EPC ที่สแกนได้และน้ำหนักรวมของชุดนี้ แล้วกดบันทึก"
      />
      <CardContent>
        <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold-duotone" />} sx={{ mb: 2.5 }}>
          จุดอ่าน RFID ที่ประตูชั่งน้ำหนักยังไม่เชื่อมฮาร์ดแวร์จริง — กรอกข้อมูลด้วยมือไปก่อน
        </Alert>

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
                  p: 2,
                  borderRadius: 1.5,
                  border: (theme) => `1px dashed ${theme.vars.palette.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Iconify icon="solar:qr-code-bold-duotone" width={20} sx={{ color: 'text.secondary' }} />
                  <Box sx={{ typography: 'body2', color: 'text.secondary' }}>รหัสที่พบ</Box>
                </Stack>
                <Chip
                  size="small"
                  variant="soft"
                  color={epcCodes.length > 0 ? 'primary' : 'default'}
                  label={`${epcCodes.length} รายการ`}
                />
              </Box>

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
