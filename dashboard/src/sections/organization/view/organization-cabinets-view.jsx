'use client';

import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetDepartments } from 'src/actions/departments';
import { useGetFabricCategories } from 'src/actions/fabric';
import {
  createCabinet,
  deleteCabinet,
  saveParLevels,
  useGetCabinets,
  useGetParLevels,
} from 'src/actions/cabinets';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field } from 'src/components/hook-form';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

const NewCabinetSchema = zod.object({
  name: zod.string().min(1, { message: 'กรอกชื่อตู้' }),
  departmentId: zod.coerce.number({ invalid_type_error: 'เลือกวอร์ด/แผนก' }).int().positive(),
});

function NewCabinetDialog({ open, onClose, wards, onCreated }) {
  const methods = useForm({
    resolver: zodResolver(NewCabinetSchema),
    defaultValues: { name: '', departmentId: '' },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createCabinet(data);
      toast.success('เพิ่มตู้สำเร็จ');
      reset();
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'เพิ่มตู้ไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>เพิ่มตู้เก็บผ้า</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Text name="name" label="ชื่อตู้ (เช่น ตู้ผ้า A1)" />
          <Field.Select name="departmentId" label="วอร์ด/แผนก">
            {wards.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.name}
              </MenuItem>
            ))}
          </Field.Select>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            เพิ่ม
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

function ParLevelDialog({ open, onClose, cabinet, hospitalId, categories }) {
  const { parLevels, parLevelsLoading, refreshParLevels } = useGetParLevels(
    open ? cabinet?.id : undefined,
    hospitalId
  );
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!parLevelsLoading && parLevels) {
      const map = {};
      parLevels.forEach((p) => {
        map[p.fabric_category_id] = { qty: p.par_level_qty, warningPct: p.warning_pct };
      });
      setRows(map);
    }
  }, [parLevels, parLevelsLoading]);

  const handleChange = (categoryId, field, value) => {
    setRows((prev) => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [field]: value },
    }));
  };

  const handleSave = useCallback(async () => {
    const payload = Object.entries(rows)
      .filter(([, v]) => Number(v?.qty) > 0)
      .map(([categoryId, v]) => ({
        fabricCategoryId: Number(categoryId),
        parLevelQty: Number(v.qty),
        warningPct: v.warningPct ? Number(v.warningPct) : 20,
      }));

    if (payload.length === 0) {
      toast.error('กรอกจำนวนอย่างน้อย 1 หมวดหมู่');
      return;
    }

    setSaving(true);
    try {
      await saveParLevels(cabinet.id, payload);
      toast.success('บันทึก par level สำเร็จ');
      refreshParLevels();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }, [rows, cabinet, refreshParLevels, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Par Level — {cabinet?.name}</DialogTitle>
      <DialogContent>
        {parLevelsLoading ? (
          <LoadingScreen sx={{ height: 200 }} />
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {categories.map((c) => (
              <Stack key={c.id} direction="row" spacing={2} alignItems="center">
                <TextField
                  label="หมวดหมู่ผ้า"
                  value={c.name}
                  disabled
                  sx={{ flex: 1 }}
                  size="small"
                />
                <TextField
                  label="จำนวนที่ต้องมี (Par)"
                  type="number"
                  size="small"
                  value={rows[c.id]?.qty ?? ''}
                  onChange={(e) => handleChange(c.id, 'qty', e.target.value)}
                  sx={{ width: 160 }}
                />
                <TextField
                  label="% เตือน"
                  type="number"
                  size="small"
                  value={rows[c.id]?.warningPct ?? 20}
                  onChange={(e) => handleChange(c.id, 'warningPct', e.target.value)}
                  sx={{ width: 120 }}
                />
              </Stack>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={handleSave}>
          บันทึก
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

export function OrganizationCabinetsView() {
  const { user } = useAuthContext();
  const { hospitalId } = useEffectiveHospital();

  const { departments } = useGetDepartments(hospitalId);
  const wards = departments.filter((d) => d.level_type === 'WARD');
  const wardName = (id) => departments.find((d) => d.id === id)?.name ?? '-';

  const { categories } = useGetFabricCategories(hospitalId);
  const { cabinets, cabinetsLoading, cabinetsEmpty, refreshCabinets } = useGetCabinets(hospitalId);

  const newCabinetDialog = useBoolean();
  const parLevelDialog = useBoolean();
  const [selectedCabinet, setSelectedCabinet] = useState(null);

  const handleOpenParLevels = useCallback(
    (cabinet) => {
      setSelectedCabinet(cabinet);
      parLevelDialog.onTrue();
    },
    [parLevelDialog]
  );

  const handleDelete = useCallback(
    async (cabinet) => {
      try {
        await deleteCabinet(cabinet.id);
        toast.success('ลบตู้สำเร็จ');
        refreshCabinets();
      } catch (error) {
        toast.error(error?.message || 'ลบไม่สำเร็จ');
      }
    },
    [refreshCabinets]
  );

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="lg">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="ตู้เก็บผ้า & Par Level"
          links={[{ name: 'โครงสร้างโรงพยาบาล' }, { name: 'ตู้เก็บผ้า & Par Level' }]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={newCabinetDialog.onTrue}
              disabled={!hospitalId || wards.length === 0}
            >
              เพิ่มตู้
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          {!hospitalId ? (
            <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
          ) : wards.length === 0 ? (
            <EmptyContent
              title="ยังไม่มีวอร์ด/แผนกในระบบ"
              description="ไปสร้างผังโครงสร้าง (อาคาร/ชั้น/วอร์ด) ก่อนถึงจะเพิ่มตู้ได้"
              sx={{ py: 10 }}
            />
          ) : cabinetsLoading ? (
            <LoadingScreen />
          ) : cabinetsEmpty ? (
            <EmptyContent title="ยังไม่มีตู้เก็บผ้า" sx={{ py: 10 }} />
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 640 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ชื่อตู้</TableCell>
                      <TableCell>วอร์ด/แผนก</TableCell>
                      <TableCell align="right">การจัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cabinets.map((cabinet) => (
                      <TableRow key={cabinet.id} hover>
                        <TableCell>{cabinet.name}</TableCell>
                        <TableCell>{wardName(cabinet.department_id)}</TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => handleOpenParLevels(cabinet)}>
                            <Iconify icon="solar:settings-bold-duotone" width={18} />
                          </IconButton>
                          <IconButton color="error" onClick={() => handleDelete(cabinet)}>
                            <Iconify icon="solar:trash-bin-trash-bold-duotone" width={18} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </Card>

        <NewCabinetDialog
          open={newCabinetDialog.value}
          onClose={newCabinetDialog.onFalse}
          wards={wards}
          onCreated={refreshCabinets}
        />

        <ParLevelDialog
          open={parLevelDialog.value}
          onClose={parLevelDialog.onFalse}
          cabinet={selectedCabinet}
          hospitalId={hospitalId}
          categories={categories}
        />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
