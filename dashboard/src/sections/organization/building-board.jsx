'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';

import { Iconify } from 'src/components/iconify';

import { FloorBand } from './floor-band';

// ----------------------------------------------------------------------

// ตึกหนึ่งหลัง แสดงเป็นการ์ดทรงตึก — หัวการ์ดคือป้ายชื่อตึก ด้านในเป็นชั้นเรียงซ้อนกัน
// (ชั้นบนสุดของรายการ = แถบบนสุดของการ์ด) ลากจัดลำดับชั้นได้จาก drag handle ของ FloorBand
export function BuildingBoard({
  building,
  onEditBuilding,
  onDeleteBuilding,
  onAddFloor,
  onEditFloor,
  onDeleteFloor,
  onAddWard,
  onEditWard,
  onDeleteWard,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `building-${building.id}`,
    data: { type: 'building', buildingId: building.id },
  });

  return (
    <Card
      ref={setNodeRef}
      sx={{
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <CardHeader
        avatar={
          <Box
            {...attributes}
            {...listeners}
            sx={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1.5,
              cursor: 'grab',
              touchAction: 'none',
              bgcolor: 'primary.lighter',
              color: 'primary.dark',
            }}
          >
            <Iconify icon="solar:buildings-2-bold-duotone" width={28} />
          </Box>
        }
        title={
          <Typography
            variant="h6"
            onClick={() => onEditBuilding(building)}
            sx={{ cursor: 'pointer', display: 'inline-block', '&:hover': { color: 'primary.main' } }}
          >
            {building.name}
          </Typography>
        }
        subheader={`${building.children.length} ชั้น`}
        action={
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="ลบตึกนี้">
              <IconButton color="error" onClick={() => onDeleteBuilding(building)}>
                <Iconify icon="solar:trash-bin-trash-bold-duotone" width={18} />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      <Stack spacing={1} sx={{ px: 2, pb: 2 }}>
        <SortableContext
          items={building.children.map((f) => `floor-${f.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {building.children.map((floor) => (
            <FloorBand
              key={floor.id}
              floor={floor}
              onEditFloor={onEditFloor}
              onDeleteFloor={onDeleteFloor}
              onAddWard={onAddWard}
              onEditWard={onEditWard}
              onDeleteWard={onDeleteWard}
            />
          ))}
        </SortableContext>

        <Button
          size="small"
          variant="text"
          startIcon={<Iconify icon="mingcute:add-line" width={16} />}
          onClick={() => onAddFloor(building)}
          sx={{ alignSelf: 'flex-start' }}
        >
          เพิ่มชั้น
        </Button>
      </Stack>
    </Card>
  );
}
