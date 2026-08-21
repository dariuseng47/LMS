'use client';

import { useState } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

import {
  NEXT_LEVEL,
  LEVEL_ICON,
  LEVEL_COLOR,
  LEVEL_LABEL,
  REQUIRED_PARENT_LEVEL,
} from './organization-constants';

// ----------------------------------------------------------------------

export function DepartmentNode({ node, depth, activeLevelType, onAddChild, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(true);

  const isDraggable = node.level_type !== 'BUILDING';
  const canAcceptDrop =
    activeLevelType && REQUIRED_PARENT_LEVEL[activeLevelType] === node.level_type;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag-${node.id}`,
    data: { departmentId: node.id, levelType: node.level_type },
    disabled: !isDraggable,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${node.id}`,
    data: { departmentId: node.id, levelType: node.level_type },
    disabled: !canAcceptDrop,
  });

  const hasChildren = node.children.length > 0;
  const nextLevel = NEXT_LEVEL[node.level_type];

  return (
    <Box>
      <Stack
        ref={setDropRef}
        direction="row"
        alignItems="center"
        spacing={1}
        data-testid={`department-row-${node.id}`}
        sx={{
          pl: depth * 3,
          py: 0.75,
          pr: 1,
          borderRadius: 1,
          opacity: isDragging ? 0.4 : 1,
          bgcolor: isOver && canAcceptDrop ? 'success.lighter' : 'transparent',
          outline:
            isOver && canAcceptDrop
              ? (theme) => `2px dashed ${theme.vars.palette.success.main}`
              : 'none',
          transition: 'background-color 0.15s, opacity 0.15s',
          '&:hover': { bgcolor: isOver && canAcceptDrop ? 'success.lighter' : 'action.hover' },
        }}
      >
        <IconButton
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          sx={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          <Iconify
            icon={expanded ? 'eva:arrow-ios-downward-fill' : 'eva:arrow-ios-forward-fill'}
            width={18}
          />
        </IconButton>

        <Box
          ref={setDragRef}
          {...(isDraggable ? { ...listeners, ...attributes } : {})}
          data-testid={`drag-handle-${node.id}`}
          sx={{ cursor: isDraggable ? 'grab' : 'default', display: 'flex', alignItems: 'center' }}
        >
          <Iconify
            icon={isDraggable ? 'mingcute:dot-grid-fill' : LEVEL_ICON[node.level_type]}
            width={18}
            sx={{ color: 'text.disabled', mr: 1 }}
          />
        </Box>

        <Chip
          size="small"
          variant="soft"
          color={LEVEL_COLOR[node.level_type]}
          label={LEVEL_LABEL[node.level_type]}
        />

        <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 600 }}>
          {node.name}
        </Typography>

        <Stack direction="row" spacing={0.25}>
          {nextLevel && (
            <Tooltip title={`เพิ่ม${LEVEL_LABEL[nextLevel]}ย่อย`}>
              <IconButton size="small" onClick={() => onAddChild(node)}>
                <Iconify icon="mingcute:add-line" width={16} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="แก้ไขชื่อ">
            <IconButton size="small" onClick={() => onEdit(node)}>
              <Iconify icon="solar:pen-bold-duotone" width={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="ลบ">
            <IconButton size="small" color="error" onClick={() => onDelete(node)}>
              <Iconify icon="solar:trash-bin-trash-bold-duotone" width={16} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {hasChildren && expanded && (
        <Box>
          {node.children.map((child) => (
            <DepartmentNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeLevelType={activeLevelType}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
