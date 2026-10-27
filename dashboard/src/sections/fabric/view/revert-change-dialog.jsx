'use client';

import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';

import { revertCategoryChange } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { LoadingScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

// ย้อนกลับการเปลี่ยนประเภทผ้าทั้ง batch — เปิดมาแล้วโหลด preview (ชิ้นไหนย้อนได้ / ชิ้นไหนถูกเปลี่ยนต่อไปแล้ว)
// ให้ผู้ใช้ตรวจก่อนกดยืนยันเสมอ ย้อนเสร็จแล้วเรียก onReverted(result)
export function RevertChangeDialog({ open, batchId, isRevertBatch, hospitalId, onClose, onReverted }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!open || !batchId) return undefined;
    let cancelled = false;
    setPreview(null);
    setReason('');
    setLoadError('');
    setLoading(true);
    revertCategoryChange(batchId, { confirm: false }, hospitalId)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error?.message || 'โหลดข้อมูลไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, batchId, hospitalId]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const result = await revertCategoryChange(
        batchId,
        { confirm: true, reason: reason.trim() || undefined },
        hospitalId
      );
      toast.success(
        `${isRevertBatch ? 'ย้อนการย้อนกลับ' : 'ย้อนกลับ'}สำเร็จ ${result.reverted.length} ชิ้น${
          result.conflicts.length ? ` (ข้าม ${result.conflicts.length} ชิ้นที่ถูกเปลี่ยนประเภทต่อไปแล้ว)` : ''
        }`
      );
      onReverted?.(result);
      onClose();
    } catch (error) {
      toast.error(error?.message || 'ย้อนกลับไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const revertible = preview?.revertible ?? [];
  const conflicts = preview?.conflicts ?? [];
  const title = isRevertBatch ? 'ย้อนการย้อนกลับ (ทำซ้ำ)' : 'ย้อนกลับการเปลี่ยนประเภทผ้า';

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {title}
        {batchId ? ` — รายการ #${batchId}` : ''}
      </DialogTitle>

      <DialogContent dividers>
        {loading && <LoadingScreen sx={{ height: 200 }} />}
        {loadError && <Alert severity="error">{loadError}</Alert>}

        {preview && (
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                color={revertible.length ? 'success' : 'default'}
                variant="soft"
                icon={<Iconify icon="solar:restart-bold" width={16} />}
                label={`ย้อนกลับได้ ${revertible.length} ชิ้น`}
              />
              {conflicts.length > 0 && (
                <Chip color="warning" variant="soft" label={`ข้าม (ถูกเปลี่ยนต่อแล้ว) ${conflicts.length} ชิ้น`} />
              )}
            </Stack>

            {conflicts.length > 0 && (
              <Alert severity="warning">
                ผ้า {conflicts.length} ชิ้นถูกเปลี่ยนประเภทต่อไปแล้วหลังรายการนี้ จะไม่ถูกย้อนทับ — ถ้าต้องการ
                ให้ย้อนที่รายการที่ใหม่กว่าก่อน
              </Alert>
            )}

            {revertible.length === 0 ? (
              <Alert severity="info">ไม่มีผ้าที่ย้อนกลับได้ในรายการนี้</Alert>
            ) : (
              <>
                <Typography variant="subtitle2">ผ้าที่จะถูกย้ายกลับ</Typography>
                <TableContainer sx={{ maxHeight: 300, border: (t) => `1px solid ${t.vars.palette.divider}`, borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>รหัส EPC</TableCell>
                        <TableCell>ประเภทปัจจุบัน</TableCell>
                        <TableCell>จะกลับเป็น</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {revertible.map((row) => (
                        <TableRow key={row.changeItemId}>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{row.epcCode}</TableCell>
                          <TableCell>{row.fromCategoryName}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{row.toCategoryName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {conflicts.length > 0 && (
              <>
                <Typography variant="subtitle2">ผ้าที่ข้าม</Typography>
                <TableContainer sx={{ maxHeight: 200, border: (t) => `1px solid ${t.vars.palette.divider}`, borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>รหัส EPC</TableCell>
                        <TableCell>ประเภทปัจจุบัน (เปลี่ยนต่อแล้ว)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {conflicts.map((row) => (
                        <TableRow key={row.changeItemId}>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{row.epcCode}</TableCell>
                          <TableCell>{row.currentCategoryName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {revertible.length > 0 && (
              <TextField
                fullWidth
                size="small"
                label="เหตุผลที่ย้อนกลับ (ไม่บังคับ)"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                inputProps={{ maxLength: 500 }}
              />
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={submitting}>
          ปิด
        </Button>
        <LoadingButton
          variant="contained"
          color="warning"
          loading={submitting}
          disabled={!preview || revertible.length === 0}
          onClick={handleConfirm}
          startIcon={<Iconify icon="solar:restart-bold" />}
        >
          ยืนยันย้อนกลับ {revertible.length > 0 ? `(${revertible.length} ชิ้น)` : ''}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
