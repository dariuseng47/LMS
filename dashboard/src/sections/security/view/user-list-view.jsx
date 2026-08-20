'use client';

import { z as zod } from 'zod';
import { useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';

import { useGetHospitals } from 'src/actions/hospitals';
import { DashboardContent } from 'src/layouts/dashboard';
import { createUser, deleteUser, useGetUsers } from 'src/actions/users';

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

const ROLE_LABEL = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
};

const ROLE_COLOR = {
  SUPERADMIN: 'error',
  ADMIN: 'warning',
  OPERATOR: 'default',
};

function buildSchema(isSuperadmin) {
  return zod.object({
    username: zod.string().min(3, { message: 'อย่างน้อย 3 ตัวอักษร' }),
    password: zod.string().min(8, { message: 'อย่างน้อย 8 ตัวอักษร' }),
    fullName: zod.string().min(1, { message: 'กรอกชื่อ-นามสกุล' }),
    phone: zod.string().optional(),
    role: isSuperadmin ? zod.enum(['ADMIN', 'OPERATOR']) : zod.literal('OPERATOR'),
    hospitalId: isSuperadmin
      ? zod.coerce.number({ invalid_type_error: 'เลือกโรงพยาบาล' }).int().positive()
      : zod.coerce.number().optional(),
  });
}

function NewUserDialog({ open, onClose, onCreated, isSuperadmin, hospitals }) {
  const methods = useForm({
    resolver: zodResolver(buildSchema(isSuperadmin)),
    defaultValues: {
      username: '',
      password: '',
      fullName: '',
      phone: '',
      role: isSuperadmin ? 'ADMIN' : 'OPERATOR',
      hospitalId: '',
    },
  });

  const {
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = methods;

  const role = useWatch({ control, name: 'role' });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createUser(data);
      toast.success('สร้างบัญชีผู้ใช้สำเร็จ');
      reset();
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'สร้างบัญชีไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>สร้างบัญชีผู้ใช้</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {isSuperadmin && (
            <Field.Select name="role" label="บทบาท (Role)">
              <MenuItem value="ADMIN">Admin</MenuItem>
              <MenuItem value="OPERATOR">Operator</MenuItem>
            </Field.Select>
          )}

          {isSuperadmin && role !== 'SUPERADMIN' && (
            <Field.Select name="hospitalId" label="โรงพยาบาล">
              {hospitals.map((hospital) => (
                <MenuItem key={hospital.id} value={hospital.id}>
                  {hospital.name}
                </MenuItem>
              ))}
            </Field.Select>
          )}

          <Field.Text name="username" label="Username" />
          <Field.Text name="password" label="Password" type="password" />
          <Field.Text name="fullName" label="ชื่อ-นามสกุล" />
          <Field.Text name="phone" label="เบอร์โทร (ถ้ามี)" />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            สร้างบัญชี
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

export function UserListView() {
  const { user } = useAuthContext();
  const isSuperadmin = user?.role === 'SUPERADMIN';

  const { users, usersLoading, usersEmpty, refreshUsers } = useGetUsers();
  const { hospitals } = useGetHospitals();
  const dialog = useBoolean();

  const handleCreated = useCallback(() => {
    refreshUsers();
  }, [refreshUsers]);

  const handleDelete = useCallback(
    async (id) => {
      try {
        await deleteUser(id);
        toast.success('ลบบัญชีผู้ใช้สำเร็จ');
        refreshUsers();
      } catch (error) {
        toast.error(error?.message || 'ลบบัญชีไม่สำเร็จ');
      }
    },
    [refreshUsers]
  );

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="xl">
        <CustomBreadcrumbs
          heading="ผู้ใช้งาน & สิทธิ์การเข้าถึง"
          links={[{ name: 'ความปลอดภัย & ตั้งค่าระบบ' }, { name: 'ผู้ใช้งาน & สิทธิ์การเข้าถึง' }]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={dialog.onTrue}
            >
              สร้างบัญชีผู้ใช้
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          {usersLoading ? (
            <LoadingScreen />
          ) : usersEmpty ? (
            <EmptyContent title="ยังไม่มีผู้ใช้งาน" sx={{ py: 10 }} />
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 720 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell>ชื่อ-นามสกุล</TableCell>
                      <TableCell>บทบาท</TableCell>
                      <TableCell>สถานะ</TableCell>
                      <TableCell align="right">การจัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((row) => {
                      // hard-coded boundary ตาม docs/rbac-permissions.md — admin แก้ไข/ลบได้เฉพาะ operator
                      const canManage = isSuperadmin ? row.role !== 'SUPERADMIN' : row.role === 'OPERATOR';

                      return (
                        <TableRow key={row.id} hover>
                          <TableCell>{row.username}</TableCell>
                          <TableCell>{row.full_name}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={ROLE_COLOR[row.role]}
                              label={ROLE_LABEL[row.role]}
                              variant="soft"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={row.is_active ? 'success' : 'default'}
                              label={row.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                              variant="soft"
                            />
                          </TableCell>
                          <TableCell align="right">
                            {canManage && (
                              <IconButton color="error" onClick={() => handleDelete(row.id)}>
                                <Iconify icon="solar:trash-bin-trash-bold" />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </Card>

        <NewUserDialog
          open={dialog.value}
          onClose={dialog.onFalse}
          onCreated={handleCreated}
          isSuperadmin={isSuperadmin}
          hospitals={hospitals}
        />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
