'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { useBoolean } from 'src/hooks/use-boolean';
import { useSocketEvent } from 'src/hooks/use-socket-event';

import { fDateTime } from 'src/utils/format-time';

import {
  cancelScanSession,
  confirmScanSession,
  useGetPendingScanSessions,
} from 'src/actions/scanSessions';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const tagCount = (session) => session.scanned_epcs?.length ?? 0;

const sessionTitle = (session) =>
  session.lot_code
    ? [session.lot_category_name, `ล็อต ${session.lot_code}`].filter(Boolean).join(' · ')
    : session.category_name || 'ไม่ระบุประเภท';

/**
 * แจ้งรอบสแกน Handheld ที่ค้างรออนุมัติจากระบบเดิม (ก่อนเปลี่ยนเป็นส่งผลแล้วเข้าระบบทันที) ให้เลือกเพิ่มหรือไม่เพิ่ม
 * เคลียร์หมดแล้วแถบนี้หายไปเอง ไม่มีรอบใหม่เข้ามาอีก
 */
export function PendingHandheldAlert({ hospitalId, canEdit, onRegistered }) {
  const dialog = useBoolean();
  const { pendingSessions, refreshPendingSessions } = useGetPendingScanSessions(hospitalId);

  // { id, action: 'confirm' | 'cancel' } ของรอบที่กำลังทำ, id = 'all' คือเพิ่มทั้งหมด
  const [busy, setBusy] = useState(null);

  const refresh = () => refreshPendingSessions();
  useSocketEvent('scan:reported', refresh);
  useSocketEvent('scan:confirmed', refresh);
  useSocketEvent('scan:cancelled', refresh);

  if (!canEdit || pendingSessions.length === 0) return null;

  const totalTags = pendingSessions.reduce((sum, session) => sum + tagCount(session), 0);

  const handleConfirm = async (sessions, id) => {
    setBusy({ id, action: 'confirm' });
    let created = 0;
    let skipped = 0;
    const failed = [];
    for (let i = 0; i < sessions.length; i += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await confirmScanSession(sessions[i].id);
        created += result.created.length;
        skipped += result.skipped.length;
      } catch (error) {
        failed.push(`${sessionTitle(sessions[i])}: ${error?.message || 'เพิ่มไม่สำเร็จ'}`);
      }
    }
    setBusy(null);

    if (failed.length < sessions.length) {
      toast.success(
        `เพิ่มผ้าเข้าระบบ ${created} ชิ้น${skipped ? ` (ข้าม ${skipped} ชิ้นที่ซ้ำในระบบ)` : ''}`
      );
      onRegistered();
    }
    if (failed.length > 0) toast.error(failed.join('\n'));
    refreshPendingSessions();
  };

  const handleCancel = async (session) => {
    setBusy({ id: session.id, action: 'cancel' });
    try {
      await cancelScanSession(session.id);
      toast.success('ไม่เพิ่มรอบนี้แล้ว');
    } catch (error) {
      toast.error(error?.message || 'ทำรายการไม่สำเร็จ');
    } finally {
      setBusy(null);
      refreshPendingSessions();
    }
  };

  const isBusy = (id, action) => busy?.id === id && busy.action === action;

  return (
    <>
      <Alert
        severity="warning"
        sx={{ mb: 2 }}
        action={
          <Button color="inherit" size="small" onClick={dialog.onTrue} sx={{ minHeight: 36 }}>
            จัดการ
          </Button>
        }
      >
        มีรอบสแกน Handheld ค้างรออนุมัติจากระบบเดิม {pendingSessions.length} รอบ (
        {totalTags.toLocaleString('th-TH')} แท็ก) — ยังไม่เข้าระบบ
      </Alert>

      <Dialog fullWidth maxWidth="sm" open={dialog.value} onClose={busy ? undefined : dialog.onFalse}>
        <DialogTitle sx={{ pb: 1 }}>รอบสแกน Handheld ที่ค้างจากระบบเดิม</DialogTitle>

        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            ตอนนี้ Handheld สแกนแล้วเข้าระบบทันที รอบด้านล่างส่งมาก่อนหน้านั้นจึงยังไม่ถูกเพิ่ม —
            แท็กที่มีในระบบแล้วจะถูกข้ามให้เอง
          </Typography>

          <Stack spacing={1}>
            {pendingSessions.map((session) => (
              <Stack
                key={session.id}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ sm: 'center' }}
                spacing={1.5}
                sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.neutral' }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2">
                    {sessionTitle(session)} · {tagCount(session).toLocaleString('th-TH')} แท็ก
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {[fDateTime(session.created_at), session.triggered_by_name]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <LoadingButton
                    color="inherit"
                    loading={isBusy(session.id, 'cancel')}
                    disabled={!!busy}
                    onClick={() => handleCancel(session)}
                  >
                    ไม่เพิ่ม
                  </LoadingButton>
                  <LoadingButton
                    color="primary"
                    variant="contained"
                    loading={isBusy(session.id, 'confirm')}
                    disabled={!!busy}
                    onClick={() => handleConfirm([session], session.id)}
                  >
                    เพิ่มเข้าระบบ
                  </LoadingButton>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </DialogContent>

        <DialogActions>
          {pendingSessions.length > 1 && (
            <LoadingButton
              color="primary"
              loading={isBusy('all', 'confirm')}
              disabled={!!busy}
              onClick={() => handleConfirm(pendingSessions, 'all')}
              startIcon={<Iconify icon="solar:check-read-bold-duotone" />}
              sx={{ mr: 'auto' }}
            >
              เพิ่มทั้งหมด
            </LoadingButton>
          )}
          <Button variant="outlined" color="inherit" disabled={!!busy} onClick={dialog.onFalse}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
