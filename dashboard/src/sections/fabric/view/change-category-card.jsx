'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useBoolean } from 'src/hooks/use-boolean';
import { useFitViewport } from 'src/hooks/use-fit-viewport';

import { changeFabricCategory } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { deviceName } from 'src/sections/devices/device-constants';
import { ReaderNotSelectedAlert } from 'src/sections/operations/view/scan-reader-tab';
import { NotFoundTagsButton } from 'src/sections/operations/view/not-found-tags-button';

import { useChangeCategoryList } from './use-change-category-list';
import { useChangeCategoryScan } from './use-change-category-scan';
import { ChangeCategoryTagGroup } from './change-category-tag-group';
import { ChangeCategoryStepTitle } from './change-category-step-title';
import { ChangeCategoryTargetDialog } from './change-category-target-dialog';
import { ChangeCategoryManualDialog } from './change-category-manual-dialog';
import { ChangeCategoryConfirmDialog } from './change-category-confirm-dialog';
import { ChangeCategoryItemPickerDialog } from './change-category-item-picker-dialog';
import {
  ChangeCategoryLastResult,
  ChangeCategoryTargetCard,
  ChangeCategorySummaryCard,
} from './change-category-side-cards';

// ----------------------------------------------------------------------

// เพดานต่อครั้งของ POST /fabric-items/change-category (changeCategorySchema ฝั่ง server)
const MAX_PER_BATCH = 500;

const formatCount = (n) => n.toLocaleString('th-TH');

// แท็บ "เปลี่ยนประเภทผ้า" — สแกนผ้าแบบเดียวกับหน้า "สแกนเข้าสต๊อค" (อ่านต่อเนื่อง / อ่านครั้งเดียว) ใช้ได้ทั้งเครื่องอ่าน
// RFID ที่จุดตรวจสอบและประตูชั่งน้ำหนัก (เลือกในแท็บ "เครื่องอ่าน") ผ้าที่กรอกรหัสเอง / เลือกจากคลังก็เข้ารายการเดียวกัน
// จัดกลุ่มตามประเภทปัจจุบันให้เห็นชิ้นที่ปนมา -> เลือกประเภทปลายทาง -> ตรวจผลกับ server แล้วยืนยัน
//
// reader = ผลจาก useScanReader (จุดตรวจสอบ + ประตูชั่งน้ำหนัก) | canUseReader = มีสิทธิ์สั่งเครื่องอ่าน (web.devices.view)
// active = แท็บนี้เปิดอยู่ (สลับแท็บแล้วการ์ดแค่ถูกซ่อน รายการที่สแกนไว้ไม่หาย)
export function ChangeCategoryCard({
  hospitalId,
  categories,
  lots,
  reader,
  canUseReader,
  active,
  lastResult,
  onOpenReader,
  onApplied,
  onDismissResult,
  onViewHistory,
  onRevertRequest,
}) {
  const theme = useTheme();
  const { devices, devicesLoading, deviceId } = reader;
  const device = devices.find((d) => d.id === deviceId);

  const manualDialog = useBoolean();
  const pickerDialog = useBoolean();
  const targetDialog = useBoolean();

  const [target, setTarget] = useState(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  // ผลตรวจจาก server + รหัสชุดที่ตรวจ — ตอนยืนยันส่งชุดเดิมเป๊ะ ไม่อ่านจากรายการที่อาจเปลี่ยนไปแล้ว
  const [pendingChange, setPendingChange] = useState(null);
  const busy = checking || applying;

  const list = useChangeCategoryList({ hospitalId, categories, target });
  const { lookup, tagEpcs, groups, sources, selectedEpcs } = list;
  const { notFoundEpcs } = lookup;

  const { scanning, scanOnce, continuous, continuousSec, toggleContinuous, stopContinuous } =
    useChangeCategoryScan({ hospitalId, deviceId, active, onEpcs: list.addTags });

  const listedSet = useMemo(() => new Set(tagEpcs), [tagEpcs]);
  const fromCounts = useMemo(
    () => new Map(sources.map((source) => [source.categoryId, source.epcs.length])),
    [sources]
  );

  const handleAddCodes = (codes) => {
    const fresh = codes.filter((epc) => !listedSet.has(epc)).length;
    list.addTags(codes);
    if (fresh > 0) toast.success(`เพิ่มเข้ารายการ ${formatCount(fresh)} ชิ้น`);
    else toast.info('รหัสทั้งหมดอยู่ในรายการแล้ว');
  };

  const handleCheck = async () => {
    stopContinuous(); // หยุดอ่านก่อนตรวจ กันแท็กไหลเข้ามาหลังตรวจชุดนี้ไปแล้ว
    setChecking(true);
    try {
      const payload = { epcCodes: selectedEpcs, toCategoryId: target.id };
      const preview = await changeFabricCategory({ ...payload, confirm: false }, hospitalId);
      setPendingChange({ payload, preview });
    } catch (error) {
      toast.error(error?.message || 'ตรวจสอบไม่สำเร็จ');
    } finally {
      setChecking(false);
    }
  };

  const handleApply = async (reason) => {
    setApplying(true);
    try {
      const result = await changeFabricCategory(
        { ...pendingChange.payload, reason: reason || undefined, confirm: true },
        hospitalId
      );
      toast.success(`เปลี่ยนประเภทผ้าสำเร็จ ${formatCount(result.applied.length)} ชิ้น`);
      setPendingChange(null);
      list.clear();
      onApplied(result);
    } catch (error) {
      toast.error(error?.message || 'เปลี่ยนประเภทผ้าไม่สำเร็จ');
    } finally {
      setApplying(false);
    }
  };

  // ปุ่มหลักพาไปขั้นที่ยังขาดเอง — ผู้ใช้กดปุ่มเดียวไปเรื่อย ๆ ได้โดยไม่ต้องหาว่าติดอะไร
  let action;
  if (tagEpcs.length === 0) {
    action = { label: 'สแกนผ้าที่จะเปลี่ยนก่อน' };
  } else if (!target && lookup.failedCount === 0) {
    // เลือกได้เลยไม่ต้องรอตรวจแท็ก — ระหว่างอ่านต่อเนื่องมีแท็กรอตรวจเข้ามาตลอด
    action = {
      label: 'เลือกประเภทปลายทาง',
      icon: 'solar:t-shirt-bold-duotone',
      onClick: targetDialog.onTrue,
    };
  } else if (lookup.pendingCount > 0) {
    action = { label: `กำลังตรวจสอบแท็ก… (เหลือ ${formatCount(lookup.pendingCount)})` };
  } else if (lookup.failedCount > 0) {
    action = {
      label: 'ตรวจแท็กไม่ครบ — แตะเพื่อลองใหม่',
      icon: 'solar:restart-bold',
      color: 'warning',
      onClick: lookup.retryFailed,
    };
  } else if (selectedEpcs.length === 0) {
    action = { label: 'ไม่มีผ้าที่ต้องเปลี่ยน' };
  } else if (selectedEpcs.length > MAX_PER_BATCH) {
    action = { label: `เปลี่ยนได้ไม่เกิน ${MAX_PER_BATCH} ชิ้นต่อครั้ง` };
  } else {
    action = {
      label: `ตรวจสอบและเปลี่ยน ${formatCount(selectedEpcs.length)} ชิ้น`,
      icon: 'solar:check-read-bold-duotone',
      color: 'success',
      onClick: handleCheck,
    };
  }

  // โหมดพอดีจอ (จอ md ขึ้นไป เช่น จอทัชที่จุดสแกน) แบบเดียวกับหน้าสแกนเข้าสต๊อค: ล็อกไม่ให้ทั้งหน้าเลื่อน
  // เลื่อนได้เฉพาะในกล่องรายการ — จอเล็ก/เตี้ยมาก กลับไปเลื่อนทั้งหน้าตามปกติ
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { ref: fitRef, height: fitHeight } = useFitViewport({ enabled: isDesktop && active });
  const fit = fitHeight !== null;
  const scanButtonHeight = fit ? 64 : 72;

  const renderScanButtons = (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ flexShrink: 0 }}>
      <Button
        type="button"
        size="large"
        variant="contained"
        color={continuous ? 'error' : 'primary'}
        disabled={!deviceId || scanning || busy}
        onClick={toggleContinuous}
        startIcon={
          <Iconify
            icon={continuous ? 'solar:stop-circle-bold' : 'solar:radar-2-bold-duotone'}
            width={28}
          />
        }
        sx={{
          flex: { sm: 1 },
          fontSize: 20,
          fontWeight: 700,
          minHeight: scanButtonHeight,
          ...(continuous && {
            animation: 'changeCategoryPulse 1.6s ease-in-out infinite',
            '@keyframes changeCategoryPulse': {
              '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 86, 48, 0.45)' },
              '50%': { boxShadow: '0 0 0 10px rgba(255, 86, 48, 0)' },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
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
        disabled={!deviceId || continuous || busy}
        onClick={scanOnce}
        sx={{
          px: 2.5,
          flexShrink: 0,
          fontSize: 16,
          fontWeight: 700,
          minHeight: { xs: 52, sm: scanButtonHeight },
        }}
      >
        อ่านครั้งเดียว
      </LoadingButton>
    </Stack>
  );

  const renderToolbar = (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
      <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center" sx={{ flex: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mr: 0.5 }}>
          รายการ
          {lookup.listedEpcs.length > 0 ? ` (${formatCount(lookup.listedEpcs.length)})` : ''}
        </Typography>
        {lookup.pendingCount > 0 && (
          <Chip
            size="small"
            variant="soft"
            color="info"
            icon={<Iconify icon="svg-spinners:180-ring" />}
            label={`ตรวจแล้ว ${formatCount(lookup.checkedCount)}/${formatCount(tagEpcs.length)}`}
          />
        )}
        {notFoundEpcs.length > 0 && (
          <NotFoundTagsButton epcs={notFoundEpcs} onRemove={list.removeTag} />
        )}
        {list.skippedCount > 0 && (
          <Chip size="small" variant="soft" label={`ข้าม ${formatCount(list.skippedCount)}`} />
        )}
        {lookup.failedCount > 0 && (
          <Chip
            size="small"
            color="warning"
            onClick={lookup.retryFailed}
            icon={<Iconify icon="solar:restart-bold" />}
            label={`ตรวจไม่สำเร็จ ${formatCount(lookup.failedCount)} — แตะเพื่อลองใหม่`}
          />
        )}
      </Stack>
      <Button
        color="error"
        variant="outlined"
        disabled={tagEpcs.length === 0 || scanning || busy}
        onClick={list.clear}
        startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
        sx={{ flexShrink: 0, minHeight: 44, px: 2, fontWeight: 700 }}
      >
        เคลียร์
      </Button>
    </Stack>
  );

  const renderList = (
    <Box
      sx={{
        ...(fit ? { flex: 1, minHeight: 96 } : { height: 360 }),
        borderRadius: 1.5,
        bgcolor: 'background.neutral',
        overflowY: 'auto',
        overscrollBehavior: 'contain', // ปัดรายการจนสุดแล้วไม่ลากทั้งหน้าตาม
      }}
    >
      {groups.length === 0 ? (
        <EmptyContent
          title={notFoundEpcs.length > 0 ? 'ยังไม่พบผ้าที่ลงทะเบียน' : 'ยังไม่มีผ้าในรายการ'}
          description={
            continuous
              ? 'กำลังอ่าน… นำผ้าผ่านเครื่องอ่านได้เลย ผ้าที่เจอจะขึ้นที่นี่'
              : 'กด “เริ่มอ่านต่อเนื่อง” แล้วนำผ้าผ่านเครื่องอ่าน หรือกรอกรหัส / เลือกจากคลังผ้า'
          }
          sx={{ py: 2, height: 1, bgcolor: 'transparent' }}
          slotProps={{ img: { maxWidth: fit ? 96 : 140 } }}
        />
      ) : (
        <Stack spacing={1.25} sx={{ p: 1.25 }}>
          {groups.map((group) => (
            <ChangeCategoryTagGroup
              key={group.key}
              group={group}
              targetName={target?.name}
              onToggleTag={list.toggleTag}
              onToggleGroup={list.toggleGroup}
            />
          ))}
        </Stack>
      )}
    </Box>
  );

  return (
    <>
      {/* CSS grid + gap ไม่ใช้ MUI Grid — Grid container มี margin ติดลบตาม spacing ที่ต่างกันสองโหมด ทำให้ตำแหน่งที่
          useFitViewport วัดได้ขยับตามโหมด จอที่สูงก้ำกึ่งจะสลับโหมดไปมาไม่หยุด */}
      <Box
        ref={fitRef}
        sx={{
          gap: fit ? 2 : 3,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
          // manipulation = ปิด double-tap zoom ของเบราว์เซอร์บนจอทัช แต่ยังปัด/ซูมสองนิ้วได้
          touchAction: 'manipulation',
          ...(fit && { height: fitHeight, gridTemplateRows: 'minmax(0, 1fr)' }),
        }}
      >
        <Card sx={{ display: 'flex', flexDirection: 'column' }}>
          <Stack
            direction="row"
            flexWrap="wrap"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ px: fit ? 2 : 3, pt: fit ? 2 : 3, flexShrink: 0 }}
          >
            <ChangeCategoryStepTitle
              step={1}
              title="เลือกผ้าที่จะเปลี่ยน"
              caption={device && deviceName(device.device_type, device.id)}
              done={selectedEpcs.length > 0 && lookup.ready}
            />
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                variant="outlined"
                disabled={busy}
                onClick={manualDialog.onTrue}
                startIcon={<Iconify icon="solar:keyboard-bold-duotone" />}
                sx={{ minHeight: 40 }}
              >
                กรอกรหัส
              </Button>
              <Button
                color="inherit"
                variant="outlined"
                disabled={busy}
                onClick={pickerDialog.onTrue}
                startIcon={<Iconify icon="solar:list-check-bold-duotone" />}
                sx={{ minHeight: 40 }}
              >
                เลือกจากคลัง
              </Button>
            </Stack>
          </Stack>

          <CardContent
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: fit ? 1.5 : 2,
              ...(fit && { p: 2, pt: 1.5, pb: '16px !important' }),
            }}
          >
            {canUseReader ? (
              <>
                {!devicesLoading && devices.length === 0 && (
                  <Alert
                    severity="warning"
                    sx={{ flexShrink: 0 }}
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={onOpenReader}
                        sx={{ minHeight: 36 }}
                      >
                        เครื่องอ่าน
                      </Button>
                    }
                  >
                    ยังไม่มีเครื่องอ่าน RFID ที่จุดตรวจสอบหรือประตูชั่งน้ำหนัก — กรอกรหัส
                    หรือเลือกจากคลังไปก่อนได้
                  </Alert>
                )}
                <ReaderNotSelectedAlert reader={reader} onOpenReader={onOpenReader} />
                {renderScanButtons}
              </>
            ) : (
              <Alert severity="info" sx={{ flexShrink: 0 }}>
                บัญชีนี้ยังไม่มีสิทธิ์สั่งเครื่องอ่าน RFID (สิทธิ์ “อุปกรณ์ & สัญญาณ RFID”) —
                เพิ่มผ้าด้วยการกรอกรหัส หรือเลือกจากคลังได้
              </Alert>
            )}
            {renderToolbar}
            {renderList}
          </CardContent>
        </Card>

        <Stack spacing={fit ? 2 : 2.5} sx={{ minHeight: 0 }}>
          <ChangeCategoryTargetCard
            target={target}
            fit={fit}
            disabled={busy}
            onOpen={targetDialog.onTrue}
          />
          <ChangeCategorySummaryCard
            count={selectedEpcs.length}
            sources={sources}
            target={target}
            continuous={continuous}
            fit={fit}
          />
          {/* เริ่มชุดถัดไปแล้วซ่อนแถบผลล่าสุด คืนที่ให้ตัวเลขสรุป (ย้อนกลับได้จากแท็บประวัติ) */}
          {lastResult && tagEpcs.length === 0 && (
            <ChangeCategoryLastResult
              result={lastResult}
              onRevert={onRevertRequest}
              onViewHistory={onViewHistory}
              onDismiss={onDismissResult}
            />
          )}
          <LoadingButton
            fullWidth
            type="button"
            size="large"
            variant="contained"
            color={action.color ?? 'primary'}
            loading={checking}
            disabled={!action.onClick || scanning || applying}
            onClick={action.onClick}
            startIcon={action.icon ? <Iconify icon={action.icon} width={26} /> : undefined}
            sx={{ flexShrink: 0, fontSize: 18, fontWeight: 700, minHeight: 64 }}
          >
            {action.label}
          </LoadingButton>
        </Stack>
      </Box>

      <ChangeCategoryManualDialog
        open={manualDialog.value}
        onClose={manualDialog.onFalse}
        onAdd={(codes) => {
          handleAddCodes(codes);
          manualDialog.onFalse();
        }}
      />

      <ChangeCategoryItemPickerDialog
        open={pickerDialog.value}
        hospitalId={hospitalId}
        categories={categories}
        lots={lots}
        listedEpcs={listedSet}
        maxPick={MAX_PER_BATCH}
        onClose={pickerDialog.onFalse}
        onAdd={(codes) => {
          handleAddCodes(codes);
          pickerDialog.onFalse();
        }}
      />

      <ChangeCategoryTargetDialog
        open={targetDialog.value}
        categories={categories}
        value={target}
        fromCounts={fromCounts}
        onClose={targetDialog.onFalse}
        onSelect={(category) => {
          setTarget(category);
          targetDialog.onFalse();
        }}
      />

      <ChangeCategoryConfirmDialog
        preview={pendingChange?.preview ?? null}
        applying={applying}
        onClose={() => setPendingChange(null)}
        onConfirm={handleApply}
      />
    </>
  );
}
