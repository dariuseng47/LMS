'use client';

import { z as zod } from 'zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { createFabricCategory, updateFabricCategory } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const CategorySchema = zod.object({
  groupId: zod.coerce.number({ invalid_type_error: 'เลือกหมวดหมู่' }).int().positive({ message: 'เลือกหมวดหมู่' }),
  name: zod.string().min(1, { message: 'กรอกชื่อประเภท' }),
  description: zod.string().max(500).optional(),
  // 0/ว่าง = ไม่ตั้งเกณฑ์
  maxWashCycles: zod.coerce.number({ invalid_type_error: 'กรอกเป็นตัวเลข' }).int().min(0).optional(),
});

// ประเภทผ้า (เช่น ชุดผ่าตัด, ผ้าปูเตียง) — ต้องสังกัดหมวดหมู่ผ้า (groups) เสมอ
// mode: 'create' หรือ 'edit' (ต้องมี category มาด้วยตอน edit)
export function CategoryFormDialog({
  open,
  onClose,
  mode = 'create',
  category,
  groups = [],
  hospitalId,
  onSaved,
}) {
  const methods = useForm({
    resolver: zodResolver(CategorySchema),
    defaultValues: { groupId: '', name: '', description: '', maxWashCycles: 0 },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) {
      reset({
        groupId: mode === 'edit' ? (category?.group_id ?? '') : '',
        name: mode === 'edit' ? (category?.name ?? '') : '',
        description: mode === 'edit' ? (category?.description ?? '') : '',
        maxWashCycles: mode === 'edit' ? (category?.max_wash_cycles ?? 0) : 0,
      });
    }
  }, [open, mode, category, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload = {
      groupId: data.groupId,
      name: data.name,
      description: data.description,
      hospitalId,
    };
    // ส่งเฉพาะตอนเปลี่ยนค่า (null = ล้างเกณฑ์)
    const maxWashCycles = data.maxWashCycles || null;
    const currentMaxWashCycles = mode === 'edit' ? (category?.max_wash_cycles ?? null) : null;
    if (maxWashCycles !== currentMaxWashCycles) payload.maxWashCycles = maxWashCycles;

    try {
      if (mode === 'edit') {
        await updateFabricCategory(category.id, payload);
        toast.success('แก้ไขประเภทผ้าสำเร็จ');
      } else {
        await createFabricCategory(payload);
        toast.success('เพิ่มประเภทผ้าสำเร็จ');
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
        <DialogTitle>{mode === 'edit' ? 'แก้ไขประเภทผ้า' : 'เพิ่มประเภทผ้า'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Select name="groupId" label="หมวดหมู่ผ้า" disabled={groups.length === 0}>
            {groups.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </Field.Select>
          <Field.Text name="name" label="ชื่อประเภท (เช่น ผ้าปูเตียง, เสื้อผู้ป่วย)" autoFocus />
          <Field.Text
            name="maxWashCycles"
            type="number"
            label="รอบซักไม่เกิน (ครั้ง)"
            placeholder="เช่น 100"
            helperText="ใช้เตือนผ้าซักใกล้ครบ — มีผลกับผ้าที่ไม่มีล็อต และล็อตที่ไม่ได้ตั้งรอบซักเอง · เว้นว่าง = ไม่เตือน"
          />
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
