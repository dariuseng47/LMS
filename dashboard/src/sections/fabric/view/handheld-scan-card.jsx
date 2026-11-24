'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';

import { useSocketEvent } from 'src/hooks/use-socket-event';

import { fDateTime } from 'src/utils/format-time';

import { varAlpha } from 'src/theme/styles';
import { useGetDevices } from 'src/actions/devices';
import { cancelScanSession, triggerScanSession } from 'src/actions/scanSessions';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { DeviceOptionTile } from 'src/sections/devices/reader-option-list';
import { SectionAvatar } from 'src/sections/operations/view/restock-section-avatar';

import { resolveTarget } from '../register-target';
import { RegisterSettingTile } from './register-setting-tile';
import { HandheldReviewDialog } from './handheld-review-dialog';

// ----------------------------------------------------------------------

const STEPS = [
  {
    icon: 'solar:smartphone-bold-duotone',
    title: 'สแกนบน Handheld',
    description:
      'เปิดแอป › จัดการผ้า › เพิ่มผ้าเข้าระบบ เลือกล็อตหรือประเภท แล้วเหนี่ยวไกสแกนผ้า',
  },
  {
    icon: 'solar:upload-minimalistic-bold-duotone',
    title: 'กด “ส่งผลสแกน”',
    description: 'รายการขึ้นในช่อง “รอตรวจสอบ” ของหน้านี้ทันที ไม่ต้องรีเฟรช',
  },
  {
    icon: 'solar:check-read-bold-duotone',
    title: 'ตรวจสอบ & ยืนยัน',
    description: 'ดูรายการผ้าใหม่/ผ้าซ้ำ แล้วกดยืนยันเพื่อเพิ่มผ้าเข้าระบบ',
  },
];

function StepGuide() {
  return (
    <Card sx={{ p: 2.5 }}>
      <Grid container spacing={2}>
        {STEPS.map((step, index) => (
          <Grid key={step.title} item xs={12} md={4}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <Stack
                  alignItems="center"
                  justifyContent="center"
                  sx={(theme) => ({
                    width: 52,
                    height: 52,
                    borderRadius: 1.5,
                    color: 'primary.main',
                    bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.12),
                  })}
                >
                  <Iconify icon={step.icon} width={28} />
                </Stack>
                <Stack
                  alignItems="center"
                  justifyContent="center"
                  sx={{
                    top: -8,
                    left: -8,
                    width: 24,
                    height: 24,
                    position: 'absolute',
                    borderRadius: '50%',
                    typography: 'caption',
                    fontWeight: 'fontWeightBold',
                    color: 'primary.contrastText',
                    bgcolor: 'primary.main',
                  }}
                >
                  {index + 1}
                </Stack>
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1">{step.title}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {step.description}
                </Typography>
              </Box>
            </Stack>
          </Grid>
        ))}
      </Grid>
    </Card>
  );
}

// ----------------------------------------------------------------------

const sessionTitle = (session) =>
  session.lot_code
    ? [session.lot_category_name, `ล็อต ${session.lot_code}`].filter(Boolean).join(' · ')
    : session.category_name || 'ไม่ระบุประเภท';

const sessionDevice = (session) =>
  [`Handheld #${session.device_id}`, session.device_caretaker_name].filter(Boolean).join(' · ');

function SessionTile({ session, onReview, onCancel, canEdit }) {
  const isReported = session.status === 'REPORTED';
  const color = isReported ? 'success' : 'info';
  const tagCount = session.scanned_epcs?.length ?? 0;

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems={{ sm: 'center' }}
      sx={(theme) => ({
        p: 2,
        borderRadius: 1.5,
        border: `1px solid ${varAlpha(theme.vars.palette[color].mainChannel, 0.32)}`,
        bgcolor: varAlpha(theme.vars.palette[color].mainChannel, 0.06),
      })}
    >
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={(theme) => ({
          width: 64,
          height: 64,
          flexShrink: 0,
          borderRadius: 1.5,
          color: `${color}.dark`,
          bgcolor: varAlpha(theme.vars.palette[color].mainChannel, 0.16),
        })}
      >
        {isReported ? (
          <>
            <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
              {tagCount.toLocaleString('th-TH')}
            </Typography>
            <Typography variant="caption">แท็ก</Typography>
          </>
        ) : (
          <Iconify icon="svg-spinners:180-ring" width={28} />
        )}
      </Stack>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" flexWrap="wrap" useFlexGap columnGap={1} alignItems="center">
          <Typography variant="subtitle1" sx={{ lineHeight: 1.4 }}>
            {sessionTitle(session)}
          </Typography>
          {!isReported && <Label color="info">รอผลสแกน</Label>}
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {sessionDevice(session)}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled' }}>
          {[
            fDateTime(session.created_at),
            session.triggered_by_name ? `เริ่มโดย ${session.triggered_by_name}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      </Box>

      {canEdit && (
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button
            color="inherit"
            variant={isReported ? 'text' : 'outlined'}
            onClick={onCancel}
            sx={{ minHeight: 44 }}
          >
            ยกเลิกรอบ
          </Button>
          {isReported && (
            <Button
              variant="contained"
              color="primary"
              onClick={onReview}
              startIcon={<Iconify icon="solar:check-read-bold-duotone" />}
              sx={{ minHeight: 44 }}
            >
              ตรวจสอบ
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}

// ----------------------------------------------------------------------

/**
 * แท็บ "สแกนด้วย Handheld" — รอบสแกนทั้งหมดที่ยังไม่ปิด (เริ่มจากเครื่องเอง หรือสั่งจากหน้านี้) รวมอยู่ที่เดียว
 * sessions = รอบที่ค้าง (ดึงจากหน้าหลัก ใช้ทำตัวเลขบนแท็บด้วย)
 */
export function HandheldScanCard({
  hospitalId,
  lots,
  categories,
  sessions,
  target,
  onOpenTarget,
  canEdit,
  onSessionsChanged,
  onConfirmed,
}) {
  const { devices, devicesLoading } = useGetDevices(hospitalId, 'HANDHELD');

  const [pickedDeviceId, setPickedDeviceId] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [reviewId, setReviewId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useSocketEvent('scan:trigger', onSessionsChanged);
  useSocketEvent('scan:reported', onSessionsChanged);
  useSocketEvent('scan:confirmed', onSessionsChanged);
  useSocketEvent('scan:cancelled', onSessionsChanged);

  // เครื่องที่ตั้งเป็น "ค่าเริ่มต้น" ของจุดนี้ (หน้า "อุปกรณ์ & สัญญาณ RFID") หรือเครื่องเดียวที่มี
  const defaultDevice =
    devices.find((d) => (d.default_scan_points ?? []).includes('FABRIC_REGISTER_HANDHELD')) ??
    (devices.length === 1 ? devices[0] : null);
  const deviceId = devices.some((d) => d.id === pickedDeviceId)
    ? pickedDeviceId
    : (defaultDevice?.id ?? null);

  const resolved = useMemo(
    () => resolveTarget(target, lots, categories),
    [target, lots, categories]
  );

  const reported = sessions.filter((s) => s.status === 'REPORTED');
  const waiting = sessions.filter((s) => s.status !== 'REPORTED');

  const reviewSession = sessions.find((s) => s.id === reviewId) ?? null;

  // รอบที่กำลังตรวจอยู่ถูกคนอื่นยืนยัน/ยกเลิกไปแล้ว
  useEffect(() => {
    if (reviewId && !reviewSession) setReviewId(null);
  }, [reviewId, reviewSession]);

  const handleTrigger = useCallback(async () => {
    setTriggering(true);
    try {
      await triggerScanSession({
        fabricLotId: resolved.lot?.id,
        fabricCategoryId: resolved.lot ? undefined : resolved.category.id,
        deviceId,
      });
      toast.success('สร้างรอบสแกนแล้ว — รอผลจากเครื่อง Handheld');
      onSessionsChanged();
    } catch (error) {
      toast.error(error?.message || 'เริ่มรอบสแกนไม่สำเร็จ');
    } finally {
      setTriggering(false);
    }
  }, [resolved, deviceId, onSessionsChanged]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelScanSession(cancelTarget.id);
      toast.success('ยกเลิกรอบสแกนแล้ว');
      setCancelTarget(null);
      onSessionsChanged();
    } catch (error) {
      toast.error(error?.message || 'ยกเลิกไม่สำเร็จ');
    } finally {
      setCancelling(false);
    }
  };

  const renderSessionTile = (session) => (
    <SessionTile
      key={session.id}
      session={session}
      canEdit={canEdit}
      onReview={() => setReviewId(session.id)}
      onCancel={() => setCancelTarget(session)}
    />
  );

  const renderQueue = (
    <Card sx={{ height: 1 }}>
      <CardHeader
        avatar={<SectionAvatar icon="solar:inbox-in-bold-duotone" color="success" />}
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            รอตรวจสอบ
            {reported.length > 0 && <Label color="success">{reported.length}</Label>}
          </Stack>
        }
        subheader="ผ้าที่ Handheld สแกนส่งมาแล้ว — ยืนยันก่อนจึงจะเข้าระบบ"
      />
      <CardContent>
        {reported.length === 0 ? (
          <EmptyContent
            title="ไม่มีรายการรอตรวจสอบ"
            description="เมื่อ Handheld ส่งผลสแกน รายการจะขึ้นที่นี่เอง"
            sx={{ py: 5 }}
            slotProps={{ img: { maxWidth: 120 } }}
          />
        ) : (
          <Stack spacing={1.5}>{reported.map(renderSessionTile)}</Stack>
        )}

        {waiting.length > 0 && (
          <>
            <Divider sx={{ my: 3, borderStyle: 'dashed' }} />
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary' }}>
              กำลังสแกนอยู่ ({waiting.length})
            </Typography>
            <Stack spacing={1.5}>{waiting.map(renderSessionTile)}</Stack>
          </>
        )}
      </CardContent>
    </Card>
  );

  const renderTrigger = (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:smartphone-bold-duotone" color="info" />}
        title="สั่งเริ่มรอบสแกนจากหน้านี้"
        subheader="เลือกผ้าและเครื่อง Handheld แล้วส่งสัญญาณให้เครื่องเข้าโหมดสแกน"
      />
      <CardContent>
        <Stack spacing={2.5}>
          <RegisterSettingTile
            icon="solar:t-shirt-bold-duotone"
            label="ผ้าที่จะลงทะเบียน"
            title={resolved.ready ? resolved.title : null}
            detail={resolved.detail}
            placeholder="แตะเพื่อเลือกล็อต / ประเภทผ้า"
            action={resolved.ready ? 'เปลี่ยน' : 'เลือก'}
            disabled={triggering}
            onClick={onOpenTarget}
          />

          <Stack spacing={1}>
            <Typography variant="subtitle2">เครื่อง Handheld</Typography>
            {!devicesLoading && devices.length === 0 ? (
              <Alert severity="warning">
                ยังไม่มีเครื่อง Handheld ในโรงพยาบาลนี้ — เพิ่มในหน้า “อุปกรณ์ & สัญญาณ RFID” ก่อน
              </Alert>
            ) : (
              <Stack
                spacing={1}
                role="radiogroup"
                aria-label="เครื่อง Handheld"
                sx={{ maxHeight: 320, overflowY: 'auto' }}
              >
                {devices.map((device) => (
                  <DeviceOptionTile
                    key={device.id}
                    device={device}
                    detail={device.caretaker_name ? `ผู้ดูแล ${device.caretaker_name}` : null}
                    selected={device.id === deviceId}
                    disabled={triggering}
                    onSelect={() => setPickedDeviceId(device.id)}
                    labels={
                      (device.default_scan_points ?? []).includes('FABRIC_REGISTER_HANDHELD') && (
                        <Label color="info">ค่าเริ่มต้น</Label>
                      )
                    }
                  />
                ))}
              </Stack>
            )}
          </Stack>

          <LoadingButton
            fullWidth
            size="large"
            type="button"
            variant="contained"
            loading={triggering}
            disabled={!canEdit || !resolved.ready || !deviceId}
            onClick={handleTrigger}
            startIcon={<Iconify icon="solar:radar-2-bold-duotone" />}
            sx={{ minHeight: 56, fontSize: 16 }}
          >
            เริ่มรอบสแกน
          </LoadingButton>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Stack spacing={3}>
      <StepGuide />

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          {renderQueue}
        </Grid>
        <Grid item xs={12} md={5}>
          {renderTrigger}
        </Grid>
      </Grid>

      <HandheldReviewDialog
        session={reviewSession}
        title={reviewSession ? sessionTitle(reviewSession) : ''}
        subtitle={reviewSession ? sessionDevice(reviewSession) : ''}
        hospitalId={hospitalId}
        onClose={() => setReviewId(null)}
        onConfirmed={() => {
          onSessionsChanged();
          onConfirmed();
        }}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => (cancelling ? null : setCancelTarget(null))}
        title="ยกเลิกรอบสแกน"
        content={
          cancelTarget
            ? `ยกเลิกรอบ “${sessionTitle(cancelTarget)}” จาก ${sessionDevice(cancelTarget)}${
                cancelTarget.scanned_epcs?.length
                  ? ` — แท็กที่สแกนมาแล้ว ${cancelTarget.scanned_epcs.length} รายการจะไม่ถูกเพิ่มเข้าระบบ`
                  : ''
              }`
            : ''
        }
        action={
          <LoadingButton variant="contained" color="error" loading={cancelling} onClick={handleCancel}>
            ยกเลิกรอบ
          </LoadingButton>
        }
      />
    </Stack>
  );
}

