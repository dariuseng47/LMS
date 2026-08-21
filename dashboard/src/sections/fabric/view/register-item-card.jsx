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

import { createFabricItem } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

function buildItemSchema() {
  return zod.object({
    epcCode: zod.string().min(1, { message: 'กรอกรหัส EPC' }),
    fabricCategoryId: zod.coerce.number({ invalid_type_error: 'เลือกหมวดหมู่' }).int().positive(),
    fabricLotId: zod.coerce.number().int().positive().optional().or(zod.literal('')),
    photoUrl: zod.string().optional(),
  });
}

export function RegisterItemCard({ hospitalId, categories, lots, onCreated, onWantNewCategory }) {
  const methods = useForm({
    resolver: zodResolver(buildItemSchema()),
    defaultValues: { epcCode: '', fabricCategoryId: '', fabricLotId: '', photoUrl: '' },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createFabricItem({
        epcCode: data.epcCode,
        fabricCategoryId: data.fabricCategoryId,
        fabricLotId: data.fabricLotId || undefined,
        photoUrl: data.photoUrl || undefined,
      });
      toast.success('ลงทะเบียนผ้าสำเร็จ — เริ่มต้นที่สถานะ "สต๊อกกลาง"');
      reset();
      onCreated();
    } catch (error) {
      toast.error(error?.message || 'ลงทะเบียนผ้าไม่สำเร็จ');
    }
  });

  return (
    <Card>
      <CardHeader
        title="ลงทะเบียนผ้ารายชิ้น (พิมพ์เอง)"
        subheader='สำหรับกรณีไม่ได้ใช้ Handheld — ผูก EPC เข้าหมวดหมู่ (และล็อต ถ้ามี) ด้วยตัวเอง'
      />
      <CardContent>
        <Form methods={methods} onSubmit={onSubmit}>
          <Stack spacing={2.5}>
            <Field.Text name="epcCode" label="รหัส EPC (จาก RFID Tag)" disabled={!hospitalId} />

            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Field.Select name="fabricCategoryId" label="หมวดหมู่ผ้า" disabled={!hospitalId} fullWidth>
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

            <Field.Select name="fabricLotId" label="ล็อต (ถ้ามี)" disabled={!hospitalId}>
              <MenuItem value="">ไม่ระบุล็อต</MenuItem>
              {lots.map((lot) => (
                <MenuItem key={lot.id} value={lot.id}>
                  {lot.lot_code}
                </MenuItem>
              ))}
            </Field.Select>

            <Field.Text
              name="photoUrl"
              label="ลิงก์รูปภาพ (ถ้ามี)"
              placeholder="https://..."
              disabled={!hospitalId}
            />

            <LoadingButton
              type="submit"
              variant="contained"
              loading={isSubmitting}
              disabled={!hospitalId}
            >
              ลงทะเบียนผ้า
            </LoadingButton>
          </Stack>
        </Form>
      </CardContent>
    </Card>
  );
}
