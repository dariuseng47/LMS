'use client';

import { useMemo, useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Label } from 'src/components/label';
import { EmptyContent } from 'src/components/empty-content';

import { lotLines, lotProgress } from '../register-target';
import { OptionTile, RegisterProgress, RegisterOptionDialog } from './register-option-dialog';

// ----------------------------------------------------------------------

/**
 * popup เลือกล็อตที่จะลงผ้าเข้า (ไม่บังคับ — "ไม่ผูกล็อต" อยู่บนสุด)
 * เลือกประเภทไว้แล้ว -> ล็อตที่มีประเภทนั้นขึ้นก่อน | ล็อตที่ลงครบแล้วไปท้ายรายการ
 */
export function RegisterLotDialog({
  open,
  onClose,
  lots,
  categoryId,
  selectedId,
  onSelect,
  canEdit,
  onWantNew,
}) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const keyword = search.trim().toLowerCase();

  const visibleLots = useMemo(() => {
    const hasCategory = (lot) =>
      !!categoryId && lotLines(lot).some((line) => line.category_id === categoryId);
    return lots
      .filter(
        (lot) =>
          !keyword ||
          [
            lot.lot_code,
            ...lotLines(lot).flatMap((line) => [line.category_name, line.group_name]),
          ].some((text) => (text || '').toLowerCase().includes(keyword))
      )
      .map((lot) => ({
        lot,
        match: hasCategory(lot),
        progress: lotProgress(lot),
      }))
      .sort(
        (a, b) =>
          Number(b.match) - Number(a.match) ||
          Number(a.progress.isFull) - Number(b.progress.isFull)
      );
  }, [lots, categoryId, keyword]);

  const handleSelect = (lot) => {
    onClose();
    onSelect(lot);
  };

  return (
    <RegisterOptionDialog
      open={open}
      onClose={onClose}
      title="เลือกล็อต (ไม่บังคับ)"
      search={search}
      onSearch={setSearch}
      searchPlaceholder="ค้นหารหัสล็อต / ประเภทผ้า"
      addLabel="เพิ่มล็อต"
      onAdd={canEdit ? onWantNew : undefined}
    >
      <Stack spacing={1}>
        {!keyword && (
          <OptionTile selected={!selectedId} onClick={() => handleSelect(null)}>
            <Typography variant="subtitle1">ไม่ผูกล็อต</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              ลงทะเบียนตามประเภทผ้าอย่างเดียว เช่น ผ้าเก่าที่ใช้งานมานาน
            </Typography>
          </OptionTile>
        )}

        {visibleLots.map(({ lot, match, progress }) => {
          const lines = lotLines(lot);
          return (
            <OptionTile
              key={lot.id}
              selected={lot.id === selectedId}
              onClick={() => handleSelect(lot)}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle1" noWrap>
                  {lot.lot_code}
                </Typography>
                {match && <Label color="info">มีประเภทที่เลือก</Label>}
                {progress.isFull && <Label color="success">ครบแล้ว</Label>}
              </Stack>
              <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
                {lines.length > 0
                  ? lines.map((line) => line.category_name ?? 'ไม่ระบุประเภท').join(', ')
                  : 'ยังไม่มีประเภทผ้า — เลือกประเภทในขั้นถัดไป'}
              </Typography>
              <RegisterProgress progress={progress} sx={{ mt: 0.75 }} />
            </OptionTile>
          );
        })}

        {visibleLots.length === 0 && (
          <EmptyContent
            title={lots.length === 0 ? 'ยังไม่มีล็อต' : 'ไม่พบล็อตที่ค้นหา'}
            sx={{ py: 4 }}
            slotProps={{ img: { maxWidth: 96 } }}
          />
        )}
      </Stack>
    </RegisterOptionDialog>
  );
}
