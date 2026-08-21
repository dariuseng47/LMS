'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// แผนก/วอร์ดหนึ่งใบ แสดงเป็น pill ลากจัดลำดับได้ภายในชั้นเดียวกัน — แยก drag handle
// ออกจากปุ่มแก้ไข/ลบชัดเจน กัน pointerdown ชนกับ onClick ของปุ่ม (บทเรียนจาก MUI Chip
// onDelete ชนกับ dnd-kit listener ตอนแปะทั้งก้อน)
export function WardChip({ ward, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `ward-${ward.id}`,
    data: { type: 'ward', wardId: ward.id },
  });

  return (
    <Stack
      ref={setNodeRef}
      data-testid={`ward-chip-${ward.id}`}
      direction="row"
      alignItems="center"
      sx={{
        pl: 0.5,
        pr: 0.5,
        py: 0.25,
        gap: 0.25,
        borderRadius: 1,
        bgcolor: 'success.lighter',
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 1 : 'auto',
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        data-testid={`ward-drag-handle-${ward.id}`}
        sx={{ display: 'flex', cursor: 'grab', touchAction: 'none', px: 0.25 }}
      >
        <Iconify icon="mingcute:dot-grid-fill" width={14} sx={{ color: 'success.darker' }} />
      </Box>

      <Iconify icon="solar:hospital-bold-duotone" width={15} sx={{ color: 'success.darker' }} />

      <Typography
        variant="caption"
        onClick={onEdit}
        sx={{ fontWeight: 600, color: 'success.darker', cursor: 'pointer', px: 0.25 }}
      >
        {ward.name}
      </Typography>

      <Tooltip title="ลบแผนกนี้">
        <IconButton size="small" onClick={onDelete} sx={{ p: 0.25 }}>
          <Iconify icon="solar:close-circle-bold-duotone" width={14} sx={{ color: 'success.darker' }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
