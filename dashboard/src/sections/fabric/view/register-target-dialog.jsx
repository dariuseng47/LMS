'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';

import { varAlpha } from 'src/theme/styles';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { lotProgress } from '../register-target';

// ----------------------------------------------------------------------

const NO_GROUP_LABEL = 'ยังไม่ระบุหมวดหมู่';

function OptionTile({ selected, disabled, onClick, children }) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      sx={(theme) => ({
        px: 2,
        py: 1.25,
        width: 1,
        gap: 1.5,
        minHeight: 60,
        textAlign: 'left',
        borderRadius: 1.5,
        justifyContent: 'flex-start',
        border: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.2)}`,
        '&:hover': { bgcolor: 'action.hover' },
        ...(selected && {
          borderColor: 'primary.main',
          bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
        }),
        ...(disabled && { opacity: 0.5 }),
      })}
    >
      {children}
      {selected && (
        <Iconify icon="eva:checkmark-circle-2-fill" width={24} sx={{ color: 'primary.main' }} />
      )}
    </ButtonBase>
  );
}

function LotTile({ lot, selected, disabled, onClick }) {
  const progress = lotProgress(lot);

  return (
    <OptionTile selected={selected} disabled={disabled} onClick={onClick}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle1" noWrap>
            {lot.lot_code}
          </Typography>
          {progress?.isFull && <Label color="success">ครบแล้ว</Label>}
        </Stack>
        <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
          {lot.category_name
            ? [lot.group_name, lot.category_name].filter(Boolean).join(' › ')
            : disabled
              ? 'ยังไม่ได้ตั้งประเภทผ้า — ใช้กับ Handheld ไม่ได้'
              : 'ยังไม่ได้ตั้งประเภทผ้า — เลือกเพิ่มในขั้นถัดไป'}
        </Typography>
        {progress && (
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 0.75 }}>
            <LinearProgress
              variant="determinate"
              value={progress.percent}
              color={progress.isFull ? 'success' : 'primary'}
              sx={{ flex: 1, height: 6, borderRadius: 1 }}
            />
            <Typography variant="caption" sx={{ flexShrink: 0, color: 'text.secondary' }}>
              ลงทะเบียนแล้ว {progress.registered.toLocaleString('th-TH')}/
              {progress.quantity.toLocaleString('th-TH')}
            </Typography>
          </Stack>
        )}
      </Box>
    </OptionTile>
  );
}

// ----------------------------------------------------------------------

/**
 * popup เลือกผ้าที่จะลงทะเบียน: ตามล็อต หรือ ตามประเภทผ้า (ไม่ผูกล็อต) — เลือกแล้วปิดเอง
 * requireLotCategory = ห้ามเลือกล็อตที่ยังไม่ตั้งประเภทผ้า (รอบสแกน Handheld ระบุประเภทเพิ่มให้ล็อตไม่ได้)
 */
export function RegisterTargetDialog({
  open,
  onClose,
  lots,
  categories,
  target,
  onSelect,
  canEdit,
  onWantNewLot,
  onWantNewCategory,
  requireLotCategory = false,
}) {
  const [mode, setMode] = useState('lot');
  const [search, setSearch] = useState('');
  // ล็อตที่เลือกแล้วแต่ยังไม่มีประเภท — รอเลือกประเภทให้
  const [pendingLot, setPendingLot] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    // เลือกล็อตที่ยังไม่ตั้งประเภทไว้ (จากปุ่ม "สแกนเข้าล็อต") -> ไปขั้นเลือกประเภทเลย
    const chosenLot = lots.find((lot) => lot.id === target.lotId);
    const needsCategory = chosenLot && !chosenLot.fabric_category_id && !target.categoryId;
    setPendingLot(needsCategory ? chosenLot : null);
    if (needsCategory) setMode('category');
    else if (target.lotId) setMode('lot');
    else if (target.categoryId || lots.length === 0) setMode('category');
    else setMode('lot');
    // ตั้งค่าเริ่มต้นครั้งเดียวตอนเปิด — รายการล็อตรีเฟรชระหว่างเปิดอยู่ต้องไม่เด้งกลับ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const keyword = search.trim().toLowerCase();

  const visibleLots = useMemo(() => {
    const matched = lots.filter(
      (lot) =>
        !keyword ||
        [lot.lot_code, lot.category_name, lot.group_name].some((text) =>
          (text || '').toLowerCase().includes(keyword)
        )
    );
    // ล็อตที่ลงทะเบียนครบแล้วไปท้ายรายการ (sort เสถียร ลำดับเดิมจาก server ไม่เปลี่ยน)
    return matched.sort(
      (a, b) => Number(!!lotProgress(a)?.isFull) - Number(!!lotProgress(b)?.isFull)
    );
  }, [lots, keyword]);

  const categoryGroups = useMemo(() => {
    const byGroup = new Map();
    categories
      .filter(
        (category) =>
          !keyword ||
          [category.name, category.group_name, category.description].some((text) =>
            (text || '').toLowerCase().includes(keyword)
          )
      )
      .forEach((category) => {
        const name = category.group_name || NO_GROUP_LABEL;
        if (!byGroup.has(name)) byGroup.set(name, []);
        byGroup.get(name).push(category);
      });
    return [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'th'))
      .map(([name, items]) => ({
        name,
        items: items.sort((a, b) => a.name.localeCompare(b.name, 'th')),
      }));
  }, [categories, keyword]);

  const handleSelectLot = (lot) => {
    if (!lot.fabric_category_id) {
      setPendingLot(lot);
      setSearch('');
      setMode('category');
      return;
    }
    onSelect({ lotId: lot.id, categoryId: null });
    onClose();
  };

  const handleSelectCategory = (category) => {
    onSelect({ lotId: pendingLot?.id ?? null, categoryId: category.id });
    onClose();
  };

  const handleChangeMode = (_, next) => {
    setMode(next);
    setPendingLot(null);
    setSearch('');
  };

  const renderLots =
    visibleLots.length === 0 ? (
      <EmptyContent
        title={lots.length === 0 ? 'ยังไม่มีล็อต' : 'ไม่พบล็อตที่ค้นหา'}
        description={lots.length === 0 ? 'กด “เพิ่มล็อต” ด้านล่าง หรือเลือกตามประเภทผ้าแทน' : undefined}
        sx={{ py: 4 }}
        slotProps={{ img: { maxWidth: 96 } }}
      />
    ) : (
      <Stack spacing={1}>
        {visibleLots.map((lot) => (
          <LotTile
            key={lot.id}
            lot={lot}
            selected={lot.id === target.lotId}
            disabled={requireLotCategory && !lot.fabric_category_id}
            onClick={() => handleSelectLot(lot)}
          />
        ))}
      </Stack>
    );

  const renderCategories =
    categoryGroups.length === 0 ? (
      <EmptyContent
        title={categories.length === 0 ? 'ยังไม่มีประเภทผ้า' : 'ไม่พบประเภทผ้าที่ค้นหา'}
        description={categories.length === 0 ? 'กด “เพิ่มประเภทผ้า” ด้านล่าง' : undefined}
        sx={{ py: 4 }}
        slotProps={{ img: { maxWidth: 96 } }}
      />
    ) : (
      <Stack spacing={2.5}>
        {categoryGroups.map((group) => (
          <Stack key={group.name} spacing={1}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              {group.name}
            </Typography>
            {group.items.map((category) => (
              <OptionTile
                key={category.id}
                selected={!target.lotId && category.id === target.categoryId}
                onClick={() => handleSelectCategory(category)}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1">{category.name}</Typography>
                  {category.description && (
                    <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
                      {category.description}
                    </Typography>
                  )}
                </Box>
              </OptionTile>
            ))}
          </Stack>
        ))}
      </Stack>
    );

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle sx={{ pb: 1 }}>เลือกผ้าที่จะลงทะเบียน</DialogTitle>

      <Box sx={{ px: 3 }}>
        <Tabs value={mode} onChange={handleChangeMode} variant="fullWidth">
          <Tab
            value="lot"
            label={`ตามล็อต (${lots.length})`}
            icon={<Iconify icon="solar:box-bold-duotone" width={22} />}
            iconPosition="start"
          />
          <Tab
            value="category"
            label={`ตามประเภทผ้า (${categories.length})`}
            icon={<Iconify icon="solar:tag-bold-duotone" width={22} />}
            iconPosition="start"
          />
        </Tabs>

        <TextField
          fullWidth
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={mode === 'lot' ? 'ค้นหารหัสล็อต / ประเภทผ้า' : 'ค้นหาประเภทผ้า / หมวดหมู่'}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          sx={{ my: 2 }}
        />

        {pendingLot && (
          <Alert severity="info" sx={{ mb: 2 }}>
            ล็อต {pendingLot.lot_code} ยังไม่ได้ตั้งประเภทผ้า — เลือกประเภทผ้าของชุดนี้
          </Alert>
        )}
      </Box>

      {/* สูงคงที่ สลับแท็บ/ค้นหาแล้ว popup ไม่ยืดหด */}
      <DialogContent sx={{ height: 420, overscrollBehavior: 'contain' }}>
        {mode === 'lot' ? renderLots : renderCategories}
      </DialogContent>

      <DialogActions>
        {canEdit && (
          <Button
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={mode === 'lot' ? onWantNewLot : onWantNewCategory}
            sx={{ mr: 'auto' }}
          >
            {mode === 'lot' ? 'เพิ่มล็อต' : 'เพิ่มประเภทผ้า'}
          </Button>
        )}
        <Button variant="outlined" color="inherit" onClick={onClose}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}
