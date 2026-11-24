'use client';

import { z as zod } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useBoolean } from 'src/hooks/use-boolean';

import { deleteUser, updateUser } from 'src/actions/users';
import { clearUserPermissionsCache } from 'src/actions/permissions';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export const ROLE_LABEL = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
};

export const ROLE_COLOR = {
  SUPERADMIN: 'error',
  ADMIN: 'warning',
  OPERATOR: 'default',
};

export const LOGIN_CLIENT_LABEL = {
  mobile: 'มือถือ',
  web: 'เว็บ',
};

// เขียว = มี Socket.io connection ค้างอยู่ตอนนี้ (server/src/sockets/presence.js) — สำหรับมือถือ
// หมายถึงแอปเปิดอยู่หน้าจอจริงๆ ไม่ใช่แค่เคย login ไว้เฉยๆ
export function OnlineDot({ online }) {
  return (
    <Tooltip title={online ? 'ออนไลน์ตอนนี้' : 'ออฟไลน์'}>
      <Box
        sx={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          bgcolor: online ? 'success.main' : 'grey.400',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
    </Tooltip>
  );
}

const EditUserSchema = zod
  .object({
    fullName: zod.string().min(1, { message: 'กรอกชื่อ-นามสกุล' }),
    phone: zod.string().optional(),
    role: zod.string(),
    changePassword: zod.boolean(),
    password: zod.string(),
    isActive: zod.boolean(),
  })
  .refine((data) => !data.changePassword || data.password.length >= 8, {
    message: 'อย่างน้อย 8 ตัวอักษร',
    path: ['password'],
  });

/**
 * แก้ไขบัญชีผู้ใช้ — ใช้ร่วมกันทั้งหน้า admin & staff และหน้า superadmin
 * - บทบาท   : เฉพาะ superadmin แก้ได้ และเฉพาะบัญชี Admin/Operator
 * - รหัสผ่าน : superadmin หรือแอดมินที่ได้รับอนุญาตให้จัดการพนักงาน (ไม่รวมบัญชี superadmin)
 * กฎเดียวกับ server/src/controllers/users.controller.js#updateUser ซึ่งเป็นตัวบังคับจริง
 *
 * onRoleChanged(user) เรียกหลังบันทึกสำเร็จเมื่อบทบาทเปลี่ยน (สิทธิ์รายบุคคลถูกรีเซ็ตแล้ว)
 */
export function EditUserDialog({ open, onClose, targetUser, onSaved, onRoleChanged }) {
  const { user: actor } = useAuthContext();
  const showPassword = useBoolean();

  const isSuperadminActor = actor?.role === 'SUPERADMIN';
  const targetIsSuperadmin = targetUser?.role === 'SUPERADMIN';
  const canChangeRole = isSuperadminActor && !targetIsSuperadmin;
  const canChangePassword =
    !targetIsSuperadmin && (isSuperadminActor || !!actor?.can_manage_subordinates);

  const methods = useForm({
    resolver: zodResolver(EditUserSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      role: '',
      changePassword: false,
      password: '',
      isActive: true,
    },
  });
  const {
    handleSubmit,
    reset,
    control,
    setValue,
    clearErrors,
    formState: { isSubmitting },
  } = methods;

  const { setValue: setShowPassword } = showPassword;

  useEffect(() => {
    if (open && targetUser) {
      reset({
        fullName: targetUser.full_name ?? '',
        phone: targetUser.phone ?? '',
        role: targetUser.role ?? '',
        changePassword: false,
        password: '',
        isActive: !!targetUser.is_active,
      });
      setShowPassword(false);
    }
  }, [open, targetUser, reset, setShowPassword]);

  const [isActive, role, changePassword] = useWatch({
    control,
    name: ['isActive', 'role', 'changePassword'],
  });
  const roleChanged = canChangeRole && !!role && role !== targetUser?.role;

  const handleToggleChangePassword = (checked) => {
    setValue('changePassword', checked);
    // ปิดสวิตช์ = ไม่เปลี่ยนรหัสผ่าน จึงล้างค่าที่พิมพ์ค้างไว้ด้วย
    setValue('password', '');
    clearErrors('password');
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const passwordChanged = canChangePassword && data.changePassword;

      await updateUser(targetUser.id, {
        fullName: data.fullName,
        phone: data.phone,
        isActive: data.isActive,
        ...(roleChanged && { role: data.role }),
        ...(passwordChanged && { password: data.password }),
      });

      toast.success(
        passwordChanged ? 'แก้ไขบัญชีและตั้งรหัสผ่านใหม่สำเร็จ' : 'แก้ไขบัญชีผู้ใช้สำเร็จ'
      );
      if (roleChanged) await clearUserPermissionsCache(targetUser.id);
      onSaved();
      onClose();
      if (roleChanged) {
        onRoleChanged?.({ ...targetUser, full_name: data.fullName, role: data.role });
      }
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>แก้ไขบัญชีผู้ใช้ ({targetUser?.username})</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Text name="fullName" label="ชื่อ-นามสกุล" sx={{ mt: 1 }} />
          <Field.Text name="phone" label="เบอร์โทร (ถ้ามี)" />

          {canChangeRole && (
            <Field.Select name="role" label="บทบาท (Role)">
              <MenuItem value="ADMIN">{ROLE_LABEL.ADMIN}</MenuItem>
              <MenuItem value="OPERATOR">{ROLE_LABEL.OPERATOR}</MenuItem>
            </Field.Select>
          )}
          {roleChanged && (
            <Alert severity="warning">
              เปลี่ยนจาก {ROLE_LABEL[targetUser.role]} เป็น {ROLE_LABEL[role]} —
              สิทธิ์เมนูที่ตั้งเฉพาะบุคคลไว้จะถูกรีเซ็ตเป็นค่าเริ่มต้นของบทบาทใหม่
              (โรงพยาบาลที่ดูแลยังเหมือนเดิม) บันทึกแล้วตรวจ/ตั้งสิทธิ์ต่อได้ทันที
            </Alert>
          )}

          {canChangePassword && (
            <FormControlLabel
              control={
                <Switch
                  checked={changePassword}
                  onChange={(e) => handleToggleChangePassword(e.target.checked)}
                />
              }
              label="ตั้งรหัสผ่านใหม่"
            />
          )}
          {canChangePassword && changePassword && (
            <Field.Text
              name="password"
              label="รหัสผ่านใหม่"
              type={showPassword.value ? 'text' : 'password'}
              helperText="อย่างน้อย 8 ตัวอักษร — ผู้ใช้จะถูกออกจากระบบทุกเครื่องและต้องเข้าสู่ระบบใหม่"
              // new-password: กันเบราว์เซอร์เติมรหัสของคนที่กำลังแก้ไขลงมาให้เอง
              inputProps={{ autoComplete: 'new-password' }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={showPassword.onToggle}
                      title={showPassword.value ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      <Iconify
                        icon={showPassword.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}

          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(e) => setValue('isActive', e.target.checked)}
              />
            }
            label={isActive ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            บันทึก
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

// รวม state/handlers ที่ทั้งหน้า admin&staff กับหน้า superadmin ใช้เหมือนกัน (edit dialog + delete)
// กันโค้ดซ้ำ — เหลือแค่ NewXxxDialog กับ table columns ที่ต่างกันจริงในแต่ละหน้า
export function useUserRowActions(refreshUsers) {
  const editDialog = useBoolean();
  const [editTarget, setEditTarget] = useState(null);

  const openEdit = useCallback(
    (row) => {
      setEditTarget(row);
      editDialog.onTrue();
    },
    [editDialog]
  );

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

  return { editDialog, editTarget, openEdit, handleDelete };
}
