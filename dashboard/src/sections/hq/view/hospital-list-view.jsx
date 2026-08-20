'use client';

import { z as zod } from 'zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';

import { DashboardContent } from 'src/layouts/dashboard';
import { createHospital, useGetHospitals } from 'src/actions/hospitals';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field } from 'src/components/hook-form';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

const NewHospitalSchema = zod.object({
  name: zod.string().min(2, { message: 'กรอกชื่อโรงพยาบาลอย่างน้อย 2 ตัวอักษร' }),
  region: zod.string().optional(),
});

function NewHospitalDialog({ open, onClose, onCreated }) {
  const methods = useForm({
    resolver: zodResolver(NewHospitalSchema),
    defaultValues: { name: '', region: '' },
  });

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createHospital(data);
      toast.success('เพิ่มโรงพยาบาลสำเร็จ');
      reset();
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'เพิ่มโรงพยาบาลไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>เพิ่มโรงพยาบาล (Tenant ใหม่)</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Text name="name" label="ชื่อโรงพยาบาล" />
          <Field.Text name="region" label="ภูมิภาค (ถ้ามี)" />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            เพิ่มโรงพยาบาล
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

export function HospitalListView() {
  const { user } = useAuthContext();
  const { hospitals, hospitalsLoading, hospitalsEmpty, refreshHospitals } = useGetHospitals();
  const dialog = useBoolean();

  const handleCreated = useCallback(() => {
    refreshHospitals();
  }, [refreshHospitals]);

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN']}>
      <DashboardContent maxWidth="xl">
        <CustomBreadcrumbs
          heading="Hospital Management"
          links={[{ name: 'HQ Super Admin' }, { name: 'Hospital Management' }]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={dialog.onTrue}
            >
              เพิ่มโรงพยาบาล
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          {hospitalsLoading ? (
            <LoadingScreen />
          ) : hospitalsEmpty ? (
            <EmptyContent
              title="ยังไม่มีโรงพยาบาลในระบบ"
              description="เริ่มต้นด้วยการเพิ่มโรงพยาบาลแรก"
              sx={{ py: 10 }}
            />
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 640 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ชื่อโรงพยาบาล</TableCell>
                      <TableCell>กลุ่ม/ภาค</TableCell>
                      <TableCell>สร้างเมื่อ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {hospitals.map((hospital) => (
                      <TableRow key={hospital.id} hover>
                        <TableCell>{hospital.name}</TableCell>
                        <TableCell>{hospital.organization_name}</TableCell>
                        <TableCell>
                          {new Date(hospital.created_at).toLocaleString('th-TH')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </Card>

        <NewHospitalDialog open={dialog.value} onClose={dialog.onFalse} onCreated={handleCreated} />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
