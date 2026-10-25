'use client';

import { z as zod } from 'zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';

import { bulkCreateFabricItems } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const MAX_EPC_PER_BATCH = 500;

// วางรหัส EPC กี่รายการก็ได้ในช่องเดียว คั่นด้วยขึ้นบรรทัดใหม่/คอมมา/เว้นวรรค — พิมพ์ทีละรายการ
// (ลงทะเบียนชิ้นเดียว) ก็ใช้ช่องเดียวกันนี้ได้เลย
function parseEpcCodes(raw) {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

function buildItemSchema() {
  return zod.object({
    epcCodesRaw: zod
      .string()
      .min(1, { message: 'กรอกรหัส EPC อย่างน้อย 1 รายการ' })
      .refine((raw) => parseEpcCodes(raw).length <= MAX_EPC_PER_BATCH, {
        message: `ลงทะเบียนได้ครั้งละไม่เกิน ${MAX_EPC_PER_BATCH} ชิ้น`,
      }),
    groupId: zod.coerce.number().int().positive().optional().or(zod.literal('')),
    fabricCategoryId: zod.coerce.number({ invalid_type_error: 'เลือกประเภท' }).int().positive(),
    fabricLotId: zod.coerce.number().int().positive().optional().or(zod.literal('')),
  });
}

export function RegisterItemCard({
  hospitalId,
  groups = [],
  categories,
  lots,
  onCreated,
  onWantNewCategory,
}) {
  const methods = useForm({
    resolver: zodResolver(buildItemSchema()),
    defaultValues: { epcCodesRaw: '', groupId: '', fabricCategoryId: '', fabricLotId: '' },
  });
  const {
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { isSubmitting },
  } = methods;

  const epcCodesRaw = useWatch({ control, name: 'epcCodesRaw' });
  const epcCount = parseEpcCodes(epcCodesRaw || '').length;

  // เลือกหมวดหมู่ก่อน แล้วค่อยเลือกประเภทผ้าที่อยู่ในหมวดหมู่นั้น (ผ้าผูกกับประเภทผ้า ไม่ได้ผูกกับหมวดหมู่ตรงๆ)
  const groupId = useWatch({ control, name: 'groupId' });
  const categoryId = useWatch({ control, name: 'fabricCategoryId' });
  const groupCategories = groupId
    ? categories.filter((c) => Number(c.group_id) === Number(groupId))
    : [];

  // เปลี่ยนหมวดหมู่แล้วประเภทผ้าที่เลือกไว้ไม่อยู่ในหมวดหมู่ใหม่ -> เคลียร์ทิ้ง
  useEffect(() => {
    if (categoryId && !groupCategories.some((c) => c.id === Number(categoryId))) {
      setValue('fabricCategoryId', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const onSubmit = handleSubmit(async (data) => {
    const epcCodes = parseEpcCodes(data.epcCodesRaw);

    try {
      const result = await bulkCreateFabricItems({
        epcCodes,
        fabricCategoryId: data.fabricCategoryId,
        fabricLotId: data.fabricLotId || undefined,
        hospitalId,
      });
      toast.success(
        `ลงทะเบียนผ้าสำเร็จ ${result.created.length} ชิ้น — เริ่มต้นที่สถานะ "สต๊อกกลาง"${
          result.skipped.length ? ` (ข้าม ${result.skipped.length} ชิ้นที่ EPC ซ้ำในระบบแล้ว)` : ''
        }`
      );
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
        subheader="วางรหัส EPC ได้หลายรายการพร้อมกัน (ขึ้นบรรทัดใหม่ / คอมมา / เว้นวรรค) — เหมาะกับตอนรับผ้าล็อตใหม่ทีละมาก"
      />
      <CardContent>
        <Form methods={methods} onSubmit={onSubmit}>
          <Stack spacing={2.5}>
            <Field.Text
              name="epcCodesRaw"
              label="รหัส EPC (จาก RFID Tag)"
              placeholder={'วางได้หลายรายการ เช่น\nEPC-0001\nEPC-0002\nEPC-0003'}
              multiline
              rows={5}
              disabled={!hospitalId}
            />

            <Stack direction="row" alignItems="center" spacing={1}>
              <Chip
                size="small"
                variant="soft"
                color={epcCount > MAX_EPC_PER_BATCH ? 'error' : epcCount > 0 ? 'success' : 'default'}
                icon={<Iconify icon="solar:checklist-minimalistic-bold-duotone" width={16} />}
                label={`จะลงทะเบียน ${epcCount} ชิ้น`}
              />
              {epcCount > MAX_EPC_PER_BATCH && (
                <Typography variant="caption" sx={{ color: 'error.main' }}>
                  เกินจำนวนสูงสุดต่อครั้ง ({MAX_EPC_PER_BATCH} ชิ้น)
                </Typography>
              )}
            </Stack>

            <Field.Select name="groupId" label="หมวดหมู่ผ้า" disabled={!hospitalId}>
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.name}
                </MenuItem>
              ))}
            </Field.Select>

            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Field.Select
                name="fabricCategoryId"
                label="ประเภทผ้า"
                disabled={!hospitalId || !groupId}
                helperText={!groupId ? 'เลือกหมวดหมู่ผ้าก่อน' : undefined}
                fullWidth
              >
                {groupCategories.map((c) => (
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

            <LoadingButton
              type="submit"
              variant="contained"
              size="large"
              loading={isSubmitting}
              disabled={!hospitalId}
              startIcon={<Iconify icon="solar:t-shirt-bold-duotone" />}
            >
              ลงทะเบียนผ้า{epcCount > 1 ? ` (${epcCount} ชิ้น)` : ''}
            </LoadingButton>
          </Stack>
        </Form>
      </CardContent>
    </Card>
  );
}
