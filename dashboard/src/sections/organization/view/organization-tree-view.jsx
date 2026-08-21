'use client';

import { useState, useCallback } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { useBoolean } from 'src/hooks/use-boolean';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { updateDepartment, deleteDepartment, useGetDepartments } from 'src/actions/departments';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { DepartmentNode } from '../department-node';
import { DepartmentFormDialog } from '../department-form-dialog';
import { LEVEL_LABEL, buildDepartmentTree } from '../organization-constants';

// ----------------------------------------------------------------------

export function OrganizationTreeView() {
  const { user } = useAuthContext();
  const { hospitalId } = useEffectiveHospital();

  const { departments, departmentsLoading, refreshDepartments } = useGetDepartments(hospitalId);

  const formDialog = useBoolean();
  const [formState, setFormState] = useState({
    mode: 'create',
    levelType: 'BUILDING',
    parent: null,
    department: null,
  });

  const deleteDialog = useBoolean();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [activeLevelType, setActiveLevelType] = useState(null);

  const tree = buildDepartmentTree(departments);

  const openCreate = useCallback(
    (parent) => {
      setFormState({
        mode: 'create',
        levelType: parent ? (parent.level_type === 'BUILDING' ? 'FLOOR' : 'WARD') : 'BUILDING',
        parent,
        department: null,
      });
      formDialog.onTrue();
    },
    [formDialog]
  );

  const openEdit = useCallback(
    (department) => {
      setFormState({ mode: 'edit', levelType: department.level_type, parent: null, department });
      formDialog.onTrue();
    },
    [formDialog]
  );

  const handleDeleteClick = useCallback(
    (department) => {
      setDeleteTarget(department);
      deleteDialog.onTrue();
    },
    [deleteDialog]
  );

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deleteDepartment(deleteTarget.id);
      toast.success('ลบสำเร็จ');
      refreshDepartments();
    } catch (error) {
      toast.error(error?.message || 'ลบไม่สำเร็จ');
    } finally {
      deleteDialog.onFalse();
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteDialog, refreshDepartments]);

  const handleDragStart = useCallback((event) => {
    setActiveLevelType(event.active.data.current?.levelType ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      setActiveLevelType(null);
      const { active, over } = event;
      if (!over) return;

      const departmentId = active.data.current?.departmentId;
      const newParentId = over.data.current?.departmentId;
      if (!departmentId || !newParentId || departmentId === newParentId) return;

      try {
        await updateDepartment(departmentId, { parentId: newParentId });
        toast.success('ย้ายโครงสร้างสำเร็จ');
        refreshDepartments();
      } catch (error) {
        toast.error(error?.message || 'ย้ายไม่สำเร็จ');
      }
    },
    [refreshDepartments]
  );

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="lg">
        <CustomBreadcrumbs
          heading="ผังโครงสร้างโรงพยาบาล"
          links={[{ name: 'โครงสร้างโรงพยาบาล' }, { name: 'ผังโครงสร้าง' }]}
          action={
            <Stack direction="row" spacing={1.5} alignItems="center">
              <HospitalContextChip />
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => openCreate(null)}
                disabled={!hospitalId}
              >
                เพิ่มอาคาร
              </Button>
            </Stack>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
          ลาก (ไอคอนจุด) แล้วปล่อยลงบนแถวเป้าหมายเพื่อย้ายสายบังคับบัญชา —
          ชั้นย้ายได้เฉพาะไปอาคารอื่น วอร์ดย้ายได้เฉพาะไปชั้นอื่น
        </Typography>

        <Card sx={{ p: 2 }}>
          {!hospitalId ? (
            <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
          ) : departmentsLoading ? (
            <LoadingScreen />
          ) : tree.length === 0 ? (
            <EmptyContent title="ยังไม่มีโครงสร้างอาคารในโรงพยาบาลนี้" sx={{ py: 10 }} />
          ) : (
            <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <Stack spacing={0.5}>
                {tree.map((node) => (
                  <DepartmentNode
                    key={node.id}
                    node={node}
                    depth={0}
                    activeLevelType={activeLevelType}
                    onAddChild={openCreate}
                    onEdit={openEdit}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </Stack>
              <DragOverlay />
            </DndContext>
          )}
        </Card>

        <DepartmentFormDialog
          open={formDialog.value}
          onClose={formDialog.onFalse}
          mode={formState.mode}
          levelType={formState.levelType}
          parent={formState.parent}
          department={formState.department}
          onSaved={refreshDepartments}
        />

        <Dialog open={deleteDialog.value} onClose={deleteDialog.onFalse} maxWidth="xs" fullWidth>
          <DialogTitle>ยืนยันการลบ</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              ต้องการลบ
              {deleteTarget
                ? ` ${LEVEL_LABEL[deleteTarget.level_type]} "${deleteTarget.name}"`
                : ''}{' '}
              ใช่หรือไม่? (ต้องไม่มีแผนกย่อยหรือตู้ผูกอยู่)
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={deleteDialog.onFalse}>
              ยกเลิก
            </Button>
            <Button variant="contained" color="error" onClick={handleConfirmDelete}>
              ลบ
            </Button>
          </DialogActions>
        </Dialog>
      </DashboardContent>
    </RoleBasedGuard>
  );
}
