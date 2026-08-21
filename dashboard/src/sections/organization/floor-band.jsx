'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

import { WardChip } from './ward-chip';

// ----------------------------------------------------------------------

// ชั้นหนึ่งชั้นในตึก — แสดงเป็นแถบแนวนอน ลากจัดลำดับชั้นได้จาก drag handle ด้านซ้าย
// แผนก/วอร์ดของชั้นนี้เรียงเป็นแถวอยู่ด้านในอีกที ลากจัดลำดับกันเองได้เช่นกัน
export function FloorBand({ floor, onEditFloor, onDeleteFloor, onAddWard, onEditWard, onDeleteWard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `floor-${floor.id}`,
    data: { type: 'floor', floorId: floor.id },
  });

  return (
    <Box
      ref={setNodeRef}
      data-testid={`floor-band-${floor.id}`}
      sx={{
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={1}
        sx={{
          p: 1.25,
          borderRadius: 1.5,
          bgcolor: 'background.neutral',
          border: (theme) => `1px solid ${theme.vars.palette.divider}`,
        }}
      >
        <Box
          {...attributes}
          {...listeners}
          data-testid={`floor-drag-handle-${floor.id}`}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab',
            touchAction: 'none',
            alignSelf: 'stretch',
            px: 0.5,
          }}
        >
          <Iconify icon="mingcute:dot-grid-fill" width={16} sx={{ color: 'text.disabled' }} />
        </Box>

        <Stack sx={{ minWidth: 96, pt: 0.25 }}>
          <Typography
            variant="subtitle2"
            onClick={() => onEditFloor(floor)}
            sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
          >
            {floor.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {floor.children.length} แผนก
          </Typography>
        </Stack>

        <SortableContext
          items={floor.children.map((w) => `ward-${w.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          <Stack direction="row" flexWrap="wrap" spacing={0.75} sx={{ flexGrow: 1, gap: 0.75, pt: 0.25 }}>
            {floor.children.map((ward) => (
              <WardChip
                key={ward.id}
                ward={ward}
                onEdit={() => onEditWard(ward)}
                onDelete={() => onDeleteWard(ward)}
              />
            ))}

            <Tooltip title="เพิ่มแผนกในชั้นนี้">
              <IconButton size="small" onClick={() => onAddWard(floor)} sx={{ border: (theme) => `1px dashed ${theme.vars.palette.divider}` }}>
                <Iconify icon="mingcute:add-line" width={14} />
              </IconButton>
            </Tooltip>
          </Stack>
        </SortableContext>

        <Tooltip title="ลบชั้นนี้">
          <IconButton size="small" color="error" onClick={() => onDeleteFloor(floor)}>
            <Iconify icon="solar:trash-bin-trash-bold-duotone" width={16} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}
