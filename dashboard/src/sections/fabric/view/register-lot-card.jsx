'use client';

import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import CardHeader from '@mui/material/CardHeader';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';

import { createFabricLot } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const NewLotSchema = zod.object({
  lotCode: zod.string().min(1, { message: 'กรอกรหัสล็อต' }),
  purchasedAt: zod.string().optional(),
  quantity: zod.coerce.number().int().positive({ message: 'ต้องมากกว่า 0' }),
  fabricCategoryId: zod.coerce.number().int().positive().optional().or(zod.literal('')),
  maxWashCycles: zod.coerce.number().int().positive().optional().or(zod.literal('')),
  maxUsageMonths: zod.coerce.number().int().positive().optional().or(zod.literal('')),
});

export function RegisterLotCard({ hospitalId, categories, onCreated, onWantNewCategory }) {
  const methods = useForm({
    resolver: zodResolver(NewLotSchema),
    defaultValues: {
      lotCode: '',
      purchasedAt: '',
      quantity: '',
      fabricCategoryId: '',
      maxWashCycles: '',
      maxUsageMonths: '',
    },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createFabricLot({
        ...data,
        fabricCategoryId: data.fabricCategoryId || undefined,
        maxWashCycles: data.maxWashCycles || undefined,
        maxUsageMonths: data.maxUsageMonths || undefined,
      });
      toast.success('เพิ่มล็อตผ้าสำเร็จ — ค่อยสแกนเพิ่ม EPC รายชิ้นเข้าล็อตนี้ทีหลังได้');
      reset();
      onCreated();
    } catch (error) {
      toast.error(error?.message || 'เพิ่มล็อตไม่สำเร็จ');
    }
  });

  return (
    <Card>
      <CardHeader
        title="ลงทะเบียนล็อตใหม่ (จัดซื้อ / นำเข้า)"
        subheader="สร้างหัวล็อตพร้อมเกณฑ์การใช้งาน — ค่อยสแกนเพิ่ม EPC รายชิ้นเข้าล็อตทีหลังตอนติด RFID tag จริง"
      />
      <CardContent>
        <Form methods={methods} onSubmit={onSubmit}>
          <Stack spacing={2.5}>
            <Field.Text name="lotCode" label="รหัสล็อต (เช่น LOT-2026-001)" disabled={!hospitalId} />

            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Field.Select name="fabricCategoryId" label="หมวดหมู่ผ้า" disabled={!hospitalId} fullWidth>
                <MenuItem value="">ไม่ระบุ (ตั้งทีหลังได้)</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Field.Select>
              <Button
                type="button"
                variant="outlined"
                sx={{ flexShrink: 0, height: 56 }}
                onClick={onWantNewCategory}
                disabled={!hospitalId}
              >
                <Iconify icon="mingcute:add-line" />
              </Button>
            </Stack>

            <Field.Text
              name="purchasedAt"
              label="วันที่จัดซื้อ"
              type="date"
              InputLabelProps={{ shrink: true }}
              disabled={!hospitalId}
            />
            <Field.Text name="quantity" label="จำนวนที่สั่งซื้อ" type="number" disabled={!hospitalId} />

            <Stack direction="row" spacing={2}>
              <Field.Text
                name="maxWashCycles"
                label="รอบซักไม่เกิน (ครั้ง)"
                type="number"
                disabled={!hospitalId}
                fullWidth
              />
              <Field.Text
                name="maxUsageMonths"
                label="อายุการใช้งานไม่เกิน (เดือน)"
                type="number"
                disabled={!hospitalId}
                fullWidth
              />
            </Stack>

            <LoadingButton
              type="submit"
              variant="contained"
              loading={isSubmitting}
              disabled={!hospitalId}
            >
              เพิ่มล็อต
            </LoadingButton>
          </Stack>
        </Form>
      </CardContent>
    </Card>
  );
}
