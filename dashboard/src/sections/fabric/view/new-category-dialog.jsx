'use client';

import { useForm } from 'react-hook-form';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { createFabricCategory } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

export function NewCategoryDialog({ open, onClose, onCreated }) {
  const methods = useForm({
    defaultValues: { name: '', maxWashCycles: '' },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createFabricCategory({
        name: data.name,
        maxWashCycles: data.maxWashCycles ? Number(data.maxWashCycles) : undefined,
      });
      toast.success('เพิ่มหมวดหมู่ผ้าสำเร็จ');
      reset();
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'เพิ่มหมวดหมู่ไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>เพิ่มหมวดหมู่ผ้า</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Text name="name" label="ชื่อหมวดหมู่ (เช่น ผ้าปูเตียง, เสื้อผู้ป่วย)" />
          <Field.Text name="maxWashCycles" label="รอบซักสูงสุด (ถ้ามี)" type="number" />
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
