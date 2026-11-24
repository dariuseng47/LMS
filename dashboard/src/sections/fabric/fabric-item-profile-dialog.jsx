'use client';

import 'dayjs/locale/th';
import dayjs from 'dayjs';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import LinearProgress from '@mui/material/LinearProgress';

import { fDate, fDateTime } from 'src/utils/format-time';

import { varAlpha, stylesMode } from 'src/theme/styles';
import { useGetLocationByEpc } from 'src/actions/tracking';
import { useGetMyPermissions } from 'src/actions/permissions';
import { changeFabricItemStatus, useGetFabricItemDetail } from 'src/actions/fabric';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';

import {
  washUsage,
  STATUS_LABEL,
  STATUS_COLOR,
  scanEventMeta,
  WASH_EVENT_TYPES,
  MANUAL_STATUS_CHANGE_STATUSES,
} from './fabric-constants';

// ----------------------------------------------------------------------

// โปรไฟล์ผ้ารายชิ้น — ใช้ร่วมกันระหว่าง "คลังผ้าทั้งหมด" (กดแถวในตาราง) และ "สแกนตรวจสอบผ้า" (กดผ้าที่สแกนได้)
// ข้อมูลจาก GET /fabric-items/:epc (ตัวผ้า + ล็อต/หมวดหมู่ + scan_logs ทั้งหมด) และตำแหน่งจาก /tracking/location
// ประวัติซัก = เหตุการณ์ที่นับเป็นรอบซัก (WASH_EVENT_TYPES) ส่วนไทม์ไลน์ = ทุกเหตุการณ์ที่ผ้าชิ้นนี้ถูกสแกน

const paletteColor = (color) => (color && color !== 'default' ? color : 'grey');

// channel ของสีสำหรับ varAlpha — grey ไม่มี mainChannel ใช้ 500Channel แทน
const colorChannel = (theme, key) =>
  key === 'grey' ? theme.vars.palette.grey['500Channel'] : theme.vars.palette[key].mainChannel;

const fromNowTh = (date) => (date ? dayjs(date).locale('th').fromNow() : null);

function SoftIcon({ icon, color, size = 40, iconWidth = 22 }) {
  const key = paletteColor(color);
  return (
    <Avatar
      variant="rounded"
      sx={(theme) => ({
        width: size,
        height: size,
        borderRadius: 1.25,
        color: key === 'grey' ? 'text.secondary' : `${key}.dark`,
        bgcolor: varAlpha(colorChannel(theme, key), 0.14),
        [stylesMode.dark]: {
          color: key === 'grey' ? 'text.secondary' : `${key}.light`,
        },
      })}
    >
      <Iconify icon={icon} width={iconWidth} />
    </Avatar>
  );
}

function StatTile({ icon, color, label, value, caption, children }) {
  return (
    <Box
      sx={{
        p: 1.75,
        minWidth: 0,
        borderRadius: 1.5,
        border: (theme) => `1px dashed ${varAlpha(theme.vars.palette.grey['500Channel'], 0.24)}`,
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <SoftIcon icon={icon} color={color} size={30} iconWidth={18} />
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="subtitle1" sx={{ lineHeight: 1.35, wordBreak: 'break-word' }}>
        {value}
      </Typography>
      {caption && (
        <Typography variant="caption" component="div" sx={{ color: 'text.disabled', mt: 0.25 }}>
          {caption}
        </Typography>
      )}
      {children}
    </Box>
  );
}

function HistoryItem({ log, last, roundNo }) {
  const meta = scanEventMeta(log.event_type);
  const weight = log.weight_kg != null ? Number(log.weight_kg) : null;

  return (
    <Stack direction="row" spacing={1.5}>
      <Stack alignItems="center" sx={{ flexShrink: 0 }}>
        <SoftIcon icon={meta.icon} color={meta.color} size={36} iconWidth={20} />
        {!last && <Box sx={{ flex: 1, width: 2, my: 0.5, borderRadius: 1, bgcolor: 'divider' }} />}
      </Stack>

      <Box sx={{ flex: 1, minWidth: 0, pb: last ? 0 : 2.25 }}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 0 }}>
            {roundNo != null && (
              <Box component="span" sx={{ color: 'info.main', mr: 0.75 }}>
                รอบที่ {roundNo}
              </Box>
            )}
            {meta.label}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
            {fromNowTh(log.scanned_at)}
          </Typography>
        </Stack>

        <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
          {fDateTime(log.scanned_at)}
          {log.user_name ? ` · โดย ${log.user_name}` : ''}
        </Typography>

        {(weight != null || log.is_step_skipped || log.synced_from_offline || log.sensor_error) && (
          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 0.75 }}>
            {weight != null && (
              <Label color="info" startIcon={<Iconify icon="solar:scale-bold" />}>
                {weight.toLocaleString('th-TH', { maximumFractionDigits: 3 })} กก.
              </Label>
            )}
            {!!log.is_step_skipped && (
              <Label color="error" startIcon={<Iconify icon="solar:danger-triangle-bold" />}>
                ข้ามขั้นตอน
              </Label>
            )}
            {!!log.sensor_error && <Label color="warning">เซ็นเซอร์ผิดพลาด</Label>}
            {!!log.synced_from_offline && <Label color="default">ซิงก์จากออฟไลน์</Label>}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

function HistoryList({ logs, numbered, emptyText }) {
  if (logs.length === 0) {
    return <EmptyContent title={emptyText} sx={{ py: 5 }} slotProps={{ img: { maxWidth: 96 } }} />;
  }
  return (
    <Scrollbar sx={{ maxHeight: { xs: 'none', sm: 340 } }}>
      <Box sx={{ pr: 1, py: 0.5 }}>
        {logs.map((log, index) => (
          <HistoryItem
            key={log.id}
            log={log}
            last={index === logs.length - 1}
            roundNo={numbered ? logs.length - index : null}
          />
        ))}
      </Box>
    </Scrollbar>
  );
}

function StatusChangeSection({ epc, hospitalId, currentStatus, onChanged }) {
  const [toStatus, setToStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const canManualChange = MANUAL_STATUS_CHANGE_STATUSES.includes(currentStatus);

  const handleSave = async () => {
    setSaving(true);
    try {
      await changeFabricItemStatus(
        { epcCode: epc, fromStatus: currentStatus, toStatus },
        hospitalId
      );
      toast.success(`เปลี่ยนสถานะเป็น "${STATUS_LABEL[toStatus] ?? toStatus}" แล้ว`);
      setToStatus('');
      onChanged?.();
    } catch (error) {
      toast.error(error?.message || 'เปลี่ยนสถานะไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: 'background.neutral' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <Iconify icon="solar:pen-2-bold-duotone" width={20} sx={{ color: 'text.secondary' }} />
        <Typography variant="subtitle2">เปลี่ยนสถานะผ้า</Typography>
      </Stack>

      {!canManualChange ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          ผ้าที่อยู่สถานะ &quot;{STATUS_LABEL[currentStatus] ?? currentStatus}&quot;
          เปลี่ยนสถานะด้วยมือไม่ได้ (พัก/แทงชำรุด มีขั้นตอนอนุมัติแยก)
        </Typography>
      ) : (
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            select
            size="small"
            label="เปลี่ยนเป็น"
            value={toStatus}
            onChange={(e) => setToStatus(e.target.value)}
            sx={{ minWidth: 220, flex: { xs: 1, sm: 'none' }, bgcolor: 'background.paper' }}
          >
            {MANUAL_STATUS_CHANGE_STATUSES.filter((s) => s !== currentStatus).map((s) => (
              <MenuItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </MenuItem>
            ))}
          </TextField>

          <LoadingButton
            variant="contained"
            loading={saving}
            disabled={!toStatus}
            onClick={handleSave}
          >
            บันทึก
          </LoadingButton>
        </Stack>
      )}
    </Box>
  );
}

function ProfileSkeleton() {
  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Skeleton variant="rounded" width={64} height={64} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="30%" />
          <Skeleton width="60%" height={32} />
          <Skeleton width="45%" />
        </Box>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
        }}
      >
        {[0, 1, 2, 3].map((k) => (
          <Skeleton key={k} variant="rounded" height={92} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={180} sx={{ mt: 3 }} />
    </Box>
  );
}

// ----------------------------------------------------------------------

export function FabricItemProfileDialog({ epc, hospitalId, open, onClose, onChanged }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const { fabricItem, scanHistory, detailLoading, detailError, refreshDetail } =
    useGetFabricItemDetail(open ? epc : undefined, hospitalId);
  const { location, locationLoading } = useGetLocationByEpc(open ? epc : undefined, hospitalId);
  const { myPermissions } = useGetMyPermissions();

  const [tab, setTab] = useState('wash');
  useEffect(() => {
    if (open) setTab('wash');
  }, [open, epc]);

  const canChangeStatus = myPermissions.some(
    (p) => p.key === 'web.fabric.inventory.edit' && p.effective
  );

  const washLogs = useMemo(
    () => scanHistory.filter((log) => WASH_EVENT_TYPES.includes(log.event_type)),
    [scanHistory]
  );

  const status = fabricItem?.status;
  // สีหัวโปรไฟล์ตามสถานะผ้า (ทุกสถานะใน STATUS_COLOR เป็นสี palette หลัก ไม่ใช่ default)
  const statusColor = STATUS_COLOR[status] || 'primary';
  const usage = washUsage(fabricItem?.wash_count, fabricItem?.max_wash_cycles);
  const lastScan = scanHistory[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(epc);
      toast.success('คัดลอกรหัส EPC แล้ว');
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
  };

  const renderHeader = (
    <Box
      sx={{
        position: 'relative',
        px: { xs: 2.5, sm: 3 },
        pt: { xs: 2.5, sm: 3 },
        pb: 2.5,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${varAlpha(
          theme.vars.palette[statusColor].mainChannel,
          0.18
        )} 0%, ${varAlpha(theme.vars.palette[statusColor].mainChannel, 0.03)} 70%)`,
      }}
    >
      <Iconify
        icon="solar:t-shirt-bold-duotone"
        width={180}
        sx={{
          position: 'absolute',
          right: -36,
          bottom: -54,
          opacity: 0.07,
          color: `${statusColor}.main`,
          pointerEvents: 'none',
        }}
      />

      <IconButton onClick={onClose} sx={{ position: 'absolute', top: 10, right: 10 }}>
        <Iconify icon="mingcute:close-line" />
      </IconButton>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ pr: 5 }}>
        <Avatar
          variant="rounded"
          sx={{
            width: 64,
            height: 64,
            borderRadius: 2,
            color: 'common.white',
            bgcolor: `${statusColor}.main`,
            boxShadow: `0 8px 16px 0 ${varAlpha(theme.vars.palette[statusColor].mainChannel, 0.32)}`,
          }}
        >
          <Iconify icon="solar:t-shirt-bold-duotone" width={34} />
        </Avatar>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block' }}>
            {fabricItem?.group_name ? `หมวดหมู่ ${fabricItem.group_name}` : 'โปรไฟล์ผ้า'}
          </Typography>
          <Typography variant="h5" sx={{ lineHeight: 1.3 }}>
            {fabricItem?.category_name || 'ไม่ระบุประเภทผ้า'}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', color: 'text.secondary', wordBreak: 'break-all' }}
            >
              {epc}
            </Typography>
            <Tooltip title="คัดลอกรหัส EPC">
              <IconButton size="small" onClick={handleCopy}>
                <Iconify icon="solar:copy-bold-duotone" width={16} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2, position: 'relative' }}>
        <Label
          variant="filled"
          color={STATUS_COLOR[status] || 'default'}
          startIcon={<Iconify icon="solar:record-circle-bold" />}
        >
          {STATUS_LABEL[status] ?? status}
        </Label>
        {usage?.color === 'error' && (
          <Label color="error" startIcon={<Iconify icon="solar:danger-triangle-bold" />}>
            ใกล้ครบอายุรอบซัก (เหลือ {usage.remaining} รอบ)
          </Label>
        )}
        {fabricItem?.lot_code && (
          <Label color="default" startIcon={<Iconify icon="solar:tag-horizontal-bold-duotone" />}>
            ล็อต {fabricItem.lot_code}
          </Label>
        )}
        {fabricItem?.deleted_at && <Label color="error">ลบออกจากระบบแล้ว</Label>}
      </Stack>
    </Box>
  );

  const renderStats = (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
      }}
    >
      <StatTile
        icon="solar:washing-machine-bold-duotone"
        color="info"
        label="รอบซัก"
        value={
          <>
            <Box component="span" sx={{ typography: 'h4' }}>
              {(fabricItem?.wash_count ?? 0).toLocaleString('th-TH')}
            </Box>
            <Box component="span" sx={{ typography: 'body2', color: 'text.secondary', ml: 0.5 }}>
              {fabricItem?.max_wash_cycles ? `/ ${fabricItem.max_wash_cycles}` : 'ครั้ง'}
            </Box>
          </>
        }
        caption={usage ? `ใช้ไปแล้ว ${usage.percent}%` : 'ไม่ได้กำหนดรอบซักสูงสุด'}
      >
        {usage && (
          <LinearProgress
            variant="determinate"
            value={usage.percent}
            color={usage.color}
            sx={{ mt: 1, height: 6, borderRadius: 1 }}
          />
        )}
      </StatTile>

      <StatTile
        icon="solar:map-point-bold-duotone"
        color="success"
        label="ตำแหน่งปัจจุบัน"
        value={locationLoading ? <Skeleton width="80%" /> : location?.name || 'ไม่ทราบตำแหน่ง'}
      />

      <StatTile
        icon="solar:history-bold-duotone"
        color="warning"
        label="สแกนล่าสุด"
        value={lastScan ? fromNowTh(lastScan.scanned_at) : 'ยังไม่เคยสแกน'}
        caption={lastScan ? scanEventMeta(lastScan.event_type).label : null}
      />

      <StatTile
        icon="solar:calendar-date-bold-duotone"
        color="secondary"
        label="ลงทะเบียนเมื่อ"
        value={fabricItem?.created_at ? fDate(fabricItem.created_at) : '—'}
        caption={fabricItem?.created_by_name ? `โดย ${fabricItem.created_by_name}` : null}
      />
    </Box>
  );

  const renderLotInfo = (fabricItem?.purchased_at || fabricItem?.max_usage_months) && (
    <Stack
      direction="row"
      flexWrap="wrap"
      gap={{ xs: 1, sm: 3 }}
      sx={{ mt: 1.5, px: 0.5, typography: 'caption', color: 'text.secondary' }}
    >
      {fabricItem?.purchased_at && (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Iconify icon="solar:cart-large-2-bold-duotone" width={16} />
          <span>จัดซื้อเมื่อ {fDate(fabricItem.purchased_at)}</span>
        </Stack>
      )}
      {fabricItem?.max_usage_months && (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Iconify icon="solar:hourglass-bold-duotone" width={16} />
          <span>อายุใช้งานสูงสุด {fabricItem.max_usage_months} เดือน</span>
        </Stack>
      )}
    </Stack>
  );

  const renderHistory = (
    <Box sx={{ mt: 3 }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          boxShadow: `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
        }}
      >
        <Tab
          value="wash"
          iconPosition="start"
          icon={<Iconify icon="solar:washing-machine-bold-duotone" width={20} />}
          label={`ประวัติซัก (${washLogs.length})`}
        />
        <Tab
          value="all"
          iconPosition="start"
          icon={<Iconify icon="solar:history-3-bold-duotone" width={20} />}
          label={`ไทม์ไลน์ทั้งหมด (${scanHistory.length})`}
        />
      </Tabs>

      {tab === 'wash' ? (
        <HistoryList logs={washLogs} numbered emptyText="ยังไม่มีประวัติการซัก" />
      ) : (
        <HistoryList logs={scanHistory} emptyText="ยังไม่มีประวัติการสแกน" />
      )}
    </Box>
  );

  let body;
  if (detailLoading) body = <ProfileSkeleton />;
  else if (detailError || !fabricItem)
    body = (
      <Box sx={{ position: 'relative' }}>
        <IconButton onClick={onClose} sx={{ position: 'absolute', top: 10, right: 10 }}>
          <Iconify icon="mingcute:close-line" />
        </IconButton>
        <EmptyContent
          title="ไม่พบข้อมูลผ้า"
          description={detailError?.message || `ไม่พบผ้ารหัส ${epc} ในโรงพยาบาลนี้`}
          sx={{ py: 8 }}
        />
      </Box>
    );
  else
    body = (
      <>
        {renderHeader}
        <Box sx={{ px: { xs: 2.5, sm: 3 }, pt: 2.5, pb: 3 }}>
          {renderStats}
          {renderLotInfo}
          {renderHistory}
          {canChangeStatus && status && (
            <Box sx={{ mt: 3 }}>
              <StatusChangeSection
                epc={epc}
                hospitalId={hospitalId}
                currentStatus={status}
                onChanged={() => {
                  refreshDetail();
                  onChanged?.(epc);
                }}
              />
            </Box>
          )}
        </Box>
      </>
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      PaperProps={{ sx: { overflow: 'hidden auto' } }}
    >
      {body}
    </Dialog>
  );
}
