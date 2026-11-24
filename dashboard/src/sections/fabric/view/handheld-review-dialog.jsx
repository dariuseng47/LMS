'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { confirmScanSession } from 'src/actions/scanSessions';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useRegisterCheck } from '../use-register-check';
import { DuplicateTagList } from './duplicate-tags-button';

// ----------------------------------------------------------------------

const NO_EPCS = [];

// ตรวจรายการแท็กที่ Handheld ส่งมาก่อนเพิ่มเข้าระบบ — แตะแท็กเพื่อตัดออกได้ แท็กซ้ำแยกให้ดูและไม่ถูกเพิ่ม
export function HandheldReviewDialog({ session, title, subtitle, hospitalId, onClose, onConfirmed }) {
  const open = !!session;
  const epcs = session?.scanned_epcs ?? NO_EPCS;

  const check = useRegisterCheck(epcs, hospitalId);
  const [excluded, setExcluded] = useState(new Set());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) setExcluded(new Set());
  }, [open, session?.id]);

  const selectedEpcs = useMemo(
    () => check.newEpcs.filter((epc) => !excluded.has(epc)),
    [check.newEpcs, excluded]
  );

  const handleToggle = useCallback((epc) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(epc)) next.delete(epc);
      else next.add(epc);
      return next;
    });
  }, []);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      // ไม่ได้ตัดแท็กไหนออก = ยืนยันทั้งชุด (server ข้ามตัวซ้ำและบันทึกจำนวนที่ข้ามในประวัติให้เอง)
      const { created, skipped } = await confirmScanSession(
        session.id,
        excluded.size > 0 ? { epcCodes: selectedEpcs } : {}
      );
      toast.success(
        `เพิ่มผ้าเข้าระบบ ${created.length} ชิ้น${
          skipped.length ? ` (ข้าม ${skipped.length} ชิ้นที่ซ้ำในระบบ)` : ''
        }`
      );
      onConfirmed();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'ยืนยันไม่สำเร็จ');
    } finally {
      setConfirming(false);
    }
  };

  const allDuplicate = check.ready && epcs.length > 0 && check.newEpcs.length === 0;
  // server ยืนยันรอบของล็อตที่ยังไม่ตั้งประเภทผ้าไม่ได้ (undefined = server เวอร์ชันเก่า ไม่รู้ -> ปล่อยให้ลอง)
  const lotWithoutCategory = !!session?.fabric_lot_id && session.lot_category_name === null;

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={confirming ? undefined : onClose}>
      <DialogTitle component="div" sx={{ pb: 1 }}>
        ตรวจสอบก่อนเพิ่มผ้าเข้าระบบ
        <Typography variant="subtitle1" sx={{ mt: 0.5, color: 'primary.main' }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {subtitle}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Chip
              size="small"
              variant="soft"
              color={check.pendingCount > 0 ? 'info' : 'success'}
              icon={
                <Iconify
                  icon={
                    check.pendingCount > 0 ? 'svg-spinners:180-ring' : 'solar:check-circle-bold'
                  }
                />
              }
              label={`ตรวจแล้ว ${check.checkedCount}/${epcs.length}`}
            />
            <Chip
              size="small"
              variant="soft"
              color="primary"
              label={`ผ้าใหม่ ${check.newEpcs.length}`}
            />
            {check.duplicates.length > 0 && (
              <Chip
                size="small"
                variant="soft"
                color="warning"
                label={`ลงทะเบียนแล้ว ${check.duplicates.length}`}
              />
            )}
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

          {lotWithoutCategory && (
            <Alert severity="error">
              ล็อตนี้ยังไม่ได้ตั้งประเภทผ้า จึงเพิ่มผ้าเข้าระบบไม่ได้ — ยกเลิกรอบนี้
              แล้วสแกนใหม่โดยเลือกตามประเภทผ้า
            </Alert>
          )}

          {allDuplicate && (
            <Alert severity="warning">
              ทุกแท็กในรอบนี้ลงทะเบียนในระบบแล้ว ไม่มีผ้าใหม่ให้เพิ่ม — ปิดหน้านี้แล้วกด
              “ยกเลิกรอบ” เพื่อเอาออกจากรายการ
            </Alert>
          )}

          {check.newEpcs.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                ผ้าใหม่ — แตะเพื่อตัดออก/เลือกกลับ
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {check.newEpcs.map((epc) => {
                  const selected = !excluded.has(epc);
                  return (
                    <Chip
                      key={epc}
                      clickable
                      size="small"
                      label={epc}
                      color={selected ? 'primary' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                      onClick={() => handleToggle(epc)}
                      icon={
                        <Iconify
                          icon={selected ? 'eva:checkmark-fill' : 'eva:minus-fill'}
                          width={16}
                        />
                      }
                      sx={{ fontFamily: 'monospace' }}
                    />
                  );
                })}
              </Stack>
            </Box>
          )}

          {check.duplicates.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                ลงทะเบียนในระบบแล้ว — จะไม่ถูกเพิ่มซ้ำ
              </Typography>
              <DuplicateTagList duplicates={check.duplicates} />
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" variant="outlined" onClick={onClose} disabled={confirming}>
          ปิด
        </Button>
        <LoadingButton
          variant="contained"
          color="primary"
          loading={confirming}
          disabled={!check.ready || selectedEpcs.length === 0 || lotWithoutCategory}
          onClick={handleConfirm}
          startIcon={<Iconify icon="solar:check-read-bold-duotone" />}
        >
          เพิ่มผ้าเข้าระบบ {selectedEpcs.length.toLocaleString('th-TH')} ชิ้น
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
