'use client';

import { useMemo, useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { EmptyContent } from 'src/components/empty-content';

import { lotLines, lineProgress } from '../register-target';
import { OptionTile, RegisterProgress, RegisterOptionDialog } from './register-option-dialog';

// ----------------------------------------------------------------------

const NO_GROUP_LABEL = 'ยังไม่ระบุหมวดหมู่';

const byName = (a, b) => a.name.localeCompare(b.name, 'th');

/**
 * popup เลือกประเภทผ้าที่จะลงทะเบียน (แบ่งตามหมวดหมู่) — ผูกล็อตอยู่ = ประเภทในล็อตขึ้นก่อนพร้อมยอดที่ลงแล้ว
 * ประเภทอื่นเลือกได้เหมือนกัน (เตือนว่าจะเพิ่มเข้าล็อตให้อัตโนมัติ)
 */
export function RegisterCategoryDialog({
  open,
  onClose,
  lot,
  categories,
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

  const { inLot, groups } = useMemo(() => {
    const lineById = new Map(lotLines(lot).map((line) => [line.category_id, line]));
    const matched = categories.filter(
      (category) =>
        !keyword ||
        [category.name, category.group_name, category.description].some((text) =>
          (text || '').toLowerCase().includes(keyword)
        )
    );

    const byGroup = new Map();
    matched
      .filter((category) => !lineById.has(category.id))
      .forEach((category) => {
        const name = category.group_name || NO_GROUP_LABEL;
        if (!byGroup.has(name)) byGroup.set(name, []);
        byGroup.get(name).push(category);
      });

    return {
      inLot: matched
        .filter((category) => lineById.has(category.id))
        .sort(byName)
        .map((category) => ({ ...category, line: lineById.get(category.id) })),
      groups: [...byGroup.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'th'))
        .map(([name, items]) => ({ name, items: items.sort(byName) })),
    };
  }, [lot, categories, keyword]);

  const renderTile = (category, line) => (
    <OptionTile
      key={category.id}
      selected={category.id === selectedId}
      onClick={() => {
        onSelect(category);
        onClose();
      }}
    >
      <Typography variant="subtitle1">{category.name}</Typography>
      {line ? (
        <RegisterProgress progress={lineProgress(line)} sx={{ mt: 0.5 }} />
      ) : (
        category.description && (
          <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
            {category.description}
          </Typography>
        )
      )}
    </OptionTile>
  );

  const isEmpty = inLot.length === 0 && groups.length === 0;

  return (
    <RegisterOptionDialog
      open={open}
      onClose={onClose}
      title="เลือกประเภทผ้าที่จะลงทะเบียน"
      search={search}
      onSearch={setSearch}
      searchPlaceholder="ค้นหาประเภทผ้า / หมวดหมู่"
      addLabel="เพิ่มประเภทผ้า"
      onAdd={canEdit ? onWantNew : undefined}
    >
      {isEmpty ? (
        <EmptyContent
          title={categories.length === 0 ? 'ยังไม่มีประเภทผ้า' : 'ไม่พบประเภทผ้าที่ค้นหา'}
          description={categories.length === 0 ? 'กด “เพิ่มประเภทผ้า” ด้านล่าง' : undefined}
          sx={{ py: 4 }}
          slotProps={{ img: { maxWidth: 96 } }}
        />
      ) : (
        <Stack spacing={2.5}>
          {inLot.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
                ในล็อต {lot.lot_code}
              </Typography>
              {inLot.map((category) => renderTile(category, category.line))}
            </Stack>
          )}

          {lot && groups.length > 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              ประเภทด้านล่างไม่อยู่ในล็อต {lot.lot_code} — เลือกได้ ระบบจะเพิ่มเข้าล็อตให้อัตโนมัติ
            </Typography>
          )}

          {groups.map((group) => (
            <Stack key={group.name} spacing={1}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                {group.name}
              </Typography>
              {group.items.map((category) => renderTile(category))}
            </Stack>
          ))}
        </Stack>
      )}
    </RegisterOptionDialog>
  );
}
