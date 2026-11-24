'use client';

import { memo } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { useBoolean } from 'src/hooks/use-boolean';

import { varAlpha } from 'src/theme/styles';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// same ใช้สีเทา — primary ของธีมเป็นเขียวเหมือน success ถ้าใช้ success จะแยกจากกลุ่มที่จะเปลี่ยนไม่ออก
const GROUP_STYLE = {
  ready: { icon: 'solar:t-shirt-bold-duotone', color: 'primary' },
  pending: { icon: 'svg-spinners:180-ring', color: 'info' },
  error: { icon: 'solar:danger-triangle-bold-duotone', color: 'warning' },
  same: { icon: 'solar:check-circle-bold-duotone', color: 'default' },
  blocked: { icon: 'solar:forbidden-circle-bold-duotone', color: 'error' },
};

const formatCount = (n) => n.toLocaleString('th-TH');
const shortEpc = (epc) => (epc.length > 6 ? epc.slice(-6) : epc);

// memo — รายการยาวหลักร้อย แท็กใหม่เข้ามาไม่ต้องวาดชิปเดิมซ้ำ
const TagChip = memo(({ epc, kind, selected, onToggle }) => {
  const toggleable = kind === 'ready';
  const active = toggleable && selected;

  return (
    <Chip
      title={epc}
      label={shortEpc(epc)}
      clickable={toggleable}
      disabled={kind === 'same' || kind === 'blocked'}
      onClick={toggleable ? () => onToggle(epc) : undefined}
      aria-pressed={toggleable ? selected : undefined}
      color={active ? 'primary' : 'default'}
      variant={active ? 'filled' : 'outlined'}
      icon={active ? <Iconify icon="eva:checkmark-fill" width={16} /> : undefined}
      sx={{
        height: 36,
        fontFamily: 'monospace',
        fontSize: 14,
        ...(toggleable && !selected && { opacity: 0.64, textDecoration: 'line-through' }),
      }}
    />
  );
});

// กลุ่มผ้าตามประเภทปัจจุบัน — ย่อไว้ก่อนให้เห็นแค่ประเภท + จำนวน แตะหัวกลุ่มหรือปุ่มลูกศร = ย่อ/ขยายดูรายชิ้น
// ช่องติ๊ก = เลือก/ยกเลิกทั้งกลุ่ม (แยกจากการแตะหัวกลุ่ม กันเผลอยกเลิกทั้งกลุ่ม) แตะชิป = รายชิ้น
// เฉพาะกลุ่ม ready ที่เลือกได้ กลุ่มอื่นโชว์ให้รู้ว่าถูกข้ามเพราะอะไร
export function ChangeCategoryTagGroup({ group, targetName, onToggleTag, onToggleGroup }) {
  const expanded = useBoolean();

  const { kind, title, caption, tags } = group;
  const { icon, color } = GROUP_STYLE[kind];
  const accent = color === 'default' ? 'grey.400' : `${color}.main`;
  const toggleable = kind === 'ready';
  const selectedCount = toggleable ? tags.filter((tag) => tag.selected).length : 0;
  const allSelected = selectedCount === tags.length;

  return (
    <Box
      sx={(theme) => ({
        flexShrink: 0,
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
        borderLeftWidth: 4,
        borderLeftColor: accent,
      })}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        onClick={expanded.onToggle}
        sx={{
          pr: 0.5,
          pl: toggleable ? 0.5 : 1.5,
          minHeight: 56,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {toggleable && (
          <Checkbox
            checked={allSelected}
            indeterminate={!allSelected && selectedCount > 0}
            onClick={(event) => event.stopPropagation()}
            onChange={() => onToggleGroup(group, !allSelected)}
            inputProps={{ 'aria-label': `เลือกทั้งกลุ่ม ${title}` }}
          />
        )}
        <Iconify icon={icon} width={24} sx={{ flexShrink: 0, color: accent }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" noWrap>
            {title}
          </Typography>
          {caption && (
            <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary' }}>
              {caption}
            </Typography>
          )}
        </Box>

        {toggleable && targetName && selectedCount > 0 && (
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            // จอมือถือซ่อน — เหลือที่ให้ชื่อประเภทปัจจุบัน (ปลายทางดูได้จากการ์ดสรุป)
            sx={{
              minWidth: 0,
              maxWidth: '38%',
              color: 'primary.main',
              display: { xs: 'none', sm: 'flex' },
            }}
          >
            <Iconify icon="eva:arrow-forward-fill" width={16} sx={{ flexShrink: 0 }} />
            <Typography variant="caption" noWrap sx={{ fontWeight: 700 }}>
              {targetName}
            </Typography>
          </Stack>
        )}
        <Label color={color} sx={{ flexShrink: 0, height: 28, px: 1, fontSize: 13 }}>
          {toggleable && !allSelected
            ? `${formatCount(selectedCount)}/${formatCount(tags.length)} ชิ้น`
            : `${formatCount(tags.length)} ชิ้น`}
        </Label>
        <IconButton
          aria-expanded={expanded.value}
          aria-label={`${expanded.value ? 'ย่อ' : 'ขยาย'}รายชิ้น ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            expanded.onToggle();
          }}
          sx={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <Iconify
            icon="eva:arrow-ios-downward-fill"
            width={20}
            sx={{
              transition: (theme) => theme.transitions.create('transform'),
              ...(expanded.value && { transform: 'rotate(180deg)' }),
            }}
          />
        </IconButton>
      </Stack>

      {/* ย่ออยู่ = ไม่วาดชิปเลย รายการหลายร้อยชิ้นหน้าไม่หน่วง */}
      <Collapse in={expanded.value} mountOnEnter unmountOnExit>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
          {tags.map((tag) => (
            <TagChip
              key={tag.epc}
              epc={tag.epc}
              kind={kind}
              selected={tag.selected}
              onToggle={onToggleTag}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
