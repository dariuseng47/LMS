'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

import { WardCard } from './ward-card';

// ----------------------------------------------------------------------

// ชั้นหนึ่งชั้นในตึก — หัวแถบมีชื่อชั้น + drag handle จัดลำดับชั้น ด้านล่างเป็นการ์ดวอร์ด/แผนก
// ของชั้นนี้ (ปกติชั้นนึงไม่เกิน 1-2 แผนก จึงให้การ์ดใหญ่ จัดการตู้เก็บผ้า/จำนวนผ้าได้ตรงนี้เลย)
export function FloorBand({
  floor,
  cabinetsByWard,
  categories,
  hospitalId,
  onEditFloor,
  onDeleteFloor,
  onAddWard,
  onEditWard,
  onDeleteWard,
  onCabinetsChanged,
}) {
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
        spacing={1.5}
        sx={{
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: 'background.neutral',
          border: (theme) => `1px solid ${theme.vars.palette.divider}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            {...attributes}
            {...listeners}
            data-testid={`floor-drag-handle-${floor.id}`}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', touchAction: 'none' }}
          >
            <Iconify icon="mingcute:dot-grid-fill" width={16} sx={{ color: 'text.disabled' }} />
          </Box>

          <Typography
            variant="subtitle2"
            onClick={() => onEditFloor(floor)}
            sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
          >
            {floor.name}
          </Typography>

          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            ({floor.children.length} แผนก)
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            size="small"
            variant="text"
            startIcon={<Iconify icon="mingcute:add-line" width={16} />}
            onClick={() => onAddWard(floor)}
          >
            เพิ่มแผนก
          </Button>

          <Tooltip title="ลบชั้นนี้">
            <IconButton size="small" color="error" onClick={() => onDeleteFloor(floor)}>
              <Iconify icon="solar:trash-bin-trash-bold-duotone" width={16} />
            </IconButton>
          </Tooltip>
        </Stack>

        {floor.children.length > 0 && (
          <SortableContext
            items={floor.children.map((w) => `ward-${w.id}`)}
            strategy={rectSortingStrategy}
          >
            <Stack direction="row" flexWrap="wrap" sx={{ gap: 1.5 }}>
              {floor.children.map((ward) => (
                <WardCard
                  key={ward.id}
                  ward={ward}
                  cabinets={cabinetsByWard.get(ward.id) ?? []}
                  categories={categories}
                  hospitalId={hospitalId}
                  onEdit={() => onEditWard(ward)}
                  onDelete={() => onDeleteWard(ward)}
                  onCabinetsChanged={onCabinetsChanged}
                />
              ))}
            </Stack>
          </SortableContext>
        )}
      </Stack>
    </Box>
  );
}
