'use client';

import { z as zod } from 'zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { createFabricGroup, updateFabricGroup } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const GroupSchema = zod.object({
  name: zod.string().trim().min(1, { message: 'กรอกชื่อหมวดหมู่' }),
  description: zod.string().max(500).optional(),
});

// หมวดหมู่ผ้า (เช่น ผ้าเสตอไลส์, ผ้าสามัญ) — mode: 'create' หรือ 'edit' (ต้องมี group มาด้วยตอน edit)
export function GroupFormDialog({ open, onClose, mode = 'create', group, hospitalId, onSaved }) {
  const methods = useForm({
    resolver: zodResolver(GroupSchema),
    defaultValues: { name: '', description: '' },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) {
      reset({
        name: mode === 'edit' ? (group?.name ?? '') : '',
        description: mode === 'edit' ? (group?.description ?? '') : '',
      });
    }
  }, [open, mode, group, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload = { name: data.name, description: data.description, hospitalId };

    try {
      if (mode === 'edit') {
        await updateFabricGroup(group.id, payload);
        toast.success('แก้ไขหมวดหมู่ผ้าสำเร็จ');
      } else {
        await createFabricGroup(payload);
        toast.success('เพิ่มหมวดหมู่ผ้าสำเร็จ');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>{mode === 'edit' ? 'แก้ไขหมวดหมู่ผ้า' : 'เพิ่มหมวดหมู่ผ้า'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Text name="name" label="ชื่อหมวดหมู่ (เช่น ผ้าเสตอไลส์, ผ้าสามัญ)" autoFocus />
          <Field.Text name="description" label="คำอธิบายเพิ่มเติม (ถ้ามี)" multiline rows={3} />
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
