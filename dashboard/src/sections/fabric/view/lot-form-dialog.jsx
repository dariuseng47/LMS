'use client';

import { z as zod } from 'zod';
import { useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { createFabricLot, updateFabricLot } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { lotLines } from '../register-target';

// ----------------------------------------------------------------------

const optionalCount = zod.coerce
  .number({ invalid_type_error: 'กรอกเป็นตัวเลข' })
  .int()
  .min(0)
  .optional();

// quantity 0/ว่าง ใช้ได้เฉพาะประเภทที่มีผ้าลงทะเบียนแล้ว (เพิ่มเข้าล็อตอัตโนมัติ ไม่มีจำนวนสั่งซื้อ)
const LotSchema = zod
  .object({
    lotCode: zod.string().trim().min(1, { message: 'กรอกรหัสล็อต' }),
    purchasedAt: zod.string().optional(),
    lines: zod.array(
      zod.object({
        categoryId: zod.number({ invalid_type_error: 'เลือกประเภทผ้า' }),
        quantity: optionalCount,
        registered: zod.number(),
      })
    ),
    maxWashCycles: optionalCount,
    maxUsageMonths: optionalCount,
  })
  .superRefine(({ lines }, ctx) => {
    const seen = new Set();
    lines.forEach((line, index) => {
      if (seen.has(line.categoryId)) {
        ctx.addIssue({ code: 'custom', path: ['lines', index, 'categoryId'], message: 'ประเภทนี้ซ้ำในล็อต' });
      }
      seen.add(line.categoryId);
      if (!line.quantity && line.registered === 0) {
        ctx.addIssue({ code: 'custom', path: ['lines', index, 'quantity'], message: 'กรอกจำนวน' });
      }
    });
  });

const EMPTY_LINE = { categoryId: null, quantity: 0, registered: 0 };

const hasDate = (value) => !!value && value !== '0000-00-00';

function lotToForm(lot) {
  const lines = lotLines(lot).map((line) => ({
    categoryId: line.category_id,
    quantity: line.quantity ?? 0,
    registered: line.registered_count,
  }));
  return {
    lotCode: lot?.lot_code ?? '',
    purchasedAt: hasDate(lot?.purchased_at) ? lot.purchased_at.slice(0, 10) : '',
    lines: lines.length > 0 ? lines : [EMPTY_LINE],
    maxWashCycles: lot?.max_wash_cycles ?? 0,
    maxUsageMonths: lot?.max_usage_months ?? 0,
  };
}

// ----------------------------------------------------------------------

// เพิ่ม/แก้ไขล็อต — lot = null คือเพิ่มใหม่ | 1 ล็อตใส่ได้หลายประเภทผ้า แต่ละประเภทมีจำนวนสั่งซื้อของตัวเอง
export function LotFormDialog({
  open,
  onClose,
  lot,
  categories,
  hospitalId,
  onSaved,
  onWantNewCategory,
}) {
  const isEdit = !!lot;

  const methods = useForm({ resolver: zodResolver(LotSchema), defaultValues: lotToForm(null) });
  const {
    handleSubmit,
    reset,
    control,
    setError,
    formState: { isSubmitting },
  } = methods;
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = useWatch({ control, name: 'lines' });

  useEffect(() => {
    if (open) reset(lotToForm(lot));
    // รีเซ็ตเฉพาะตอนเปิด — ข้อมูลล็อตรีเฟรชระหว่างกรอกต้องไม่ล้างสิ่งที่พิมพ์ไว้
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const sortedCategoryIds = useMemo(
    () =>
      [...categories]
        .sort(
          (a, b) =>
            (a.group_name || '').localeCompare(b.group_name || '', 'th') ||
            a.name.localeCompare(b.name, 'th')
        )
        .map((c) => c.id),
    [categories]
  );
  const usedIds = new Set((watchedLines ?? []).map((line) => line.categoryId));
  const total = (watchedLines ?? []).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);

  const onSubmit = handleSubmit(async (data) => {
    const lines = data.lines
      .filter((line) => line.quantity > 0)
      .map((line) => ({ fabricCategoryId: line.categoryId, quantity: line.quantity }));

    // ล็อตเดิมที่ไม่เคยมีจำนวนสั่งซื้อเลย (มีแต่ประเภทที่เพิ่มอัตโนมัติ) แก้ช่องอื่นได้โดยไม่ต้องกรอกจำนวน
    const neverHadQuantity = isEdit && lotLines(lot).every((line) => line.quantity === null);
    if (lines.length === 0 && !neverHadQuantity) {
      setError('lines.0.quantity', { message: 'ใส่จำนวนอย่างน้อย 1 ประเภท' });
      return;
    }

    try {
      if (isEdit) {
        await updateFabricLot(lot.id, {
          lotCode: data.lotCode,
          purchasedAt: data.purchasedAt || null,
          ...(lines.length > 0 && { lines }),
          maxWashCycles: data.maxWashCycles || null,
          maxUsageMonths: data.maxUsageMonths || null,
        });
        toast.success('บันทึกล็อตแล้ว');
      } else {
        await createFabricLot({
          lotCode: data.lotCode,
          purchasedAt: data.purchasedAt || undefined,
          lines,
          maxWashCycles: data.maxWashCycles || undefined,
          maxUsageMonths: data.maxUsageMonths || undefined,
          hospitalId,
        });
        toast.success('เพิ่มล็อตผ้าสำเร็จ — ค่อยสแกนผ้าเข้าล็อตนี้ทีหลังได้');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'บันทึกล็อตไม่สำเร็จ');
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>{isEdit ? `แก้ไขล็อต ${lot.lot_code}` : 'เพิ่มล็อต (จัดซื้อ / นำเข้า)'}</DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
            <Field.Text name="lotCode" label="รหัสล็อต (เช่น LOT-2026-001)" autoFocus={!isEdit} />
            <Field.Text
              name="purchasedAt"
              label="วันที่จัดซื้อ"
              type="date"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle1">ประเภทผ้าในล็อต</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                รวม {total.toLocaleString('th-TH')} ชิ้น
              </Typography>
            </Stack>

            {fields.map((field, index) => {
              const registered = watchedLines?.[index]?.registered ?? 0;
              const locked = registered > 0; // มีผ้าประเภทนี้ในล็อตแล้ว เปลี่ยน/ลบประเภทไม่ได้
              return (
                <Stack key={field.id} direction="row" spacing={1} alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Field.Autocomplete
                      name={`lines.${index}.categoryId`}
                      label="ประเภทผ้า"
                      disableClearable
                      disabled={locked}
                      options={sortedCategoryIds}
                      groupBy={(id) => categoryById.get(id)?.group_name || 'ยังไม่ระบุหมวดหมู่'}
                      getOptionLabel={(id) => categoryById.get(id)?.name ?? ''}
                      getOptionDisabled={(id) =>
                        usedIds.has(id) && id !== watchedLines?.[index]?.categoryId
                      }
                      helperText={
                        locked
                          ? `ลงทะเบียนแล้ว ${registered.toLocaleString('th-TH')} ชิ้น${
                              watchedLines?.[index]?.quantity ? '' : ' · ยังไม่มีจำนวนสั่งซื้อ'
                            }`
                          : undefined
                      }
                    />
                  </Box>
                  <Field.Text
                    name={`lines.${index}.quantity`}
                    type="number"
                    label="จำนวน"
                    sx={{ width: { xs: 92, sm: 120 }, flexShrink: 0 }}
                  />
                  <Tooltip title={locked ? 'มีผ้าลงทะเบียนแล้ว เอาออกไม่ได้' : 'เอาออก'}>
                    <span>
                      <IconButton
                        color="error"
                        aria-label="เอาประเภทนี้ออก"
                        disabled={locked || fields.length === 1}
                        onClick={() => remove(index)}
                        sx={{ mt: 1 }}
                      >
                        <Iconify icon="solar:trash-bin-trash-bold-duotone" width={20} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              );
            })}

            <Stack direction="row" spacing={1}>
              <Button
                color="primary"
                variant="soft"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => append(EMPTY_LINE)}
              >
                เพิ่มประเภทในล็อต
              </Button>
              <Button color="inherit" onClick={onWantNewCategory}>
                สร้างประเภทผ้าใหม่
              </Button>
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Field.Text
              name="maxWashCycles"
              label="รอบซักไม่เกิน (ครั้ง)"
              type="number"
              helperText="ใช้กับทุกประเภทในล็อต · เว้นว่าง = ใช้เกณฑ์ของประเภทผ้า"
            />
            <Field.Text
              name="maxUsageMonths"
              label="อายุการใช้งานไม่เกิน (เดือน)"
              type="number"
              helperText="นับจากวันที่จัดซื้อ"
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" color="primary" loading={isSubmitting}>
            {isEdit ? 'บันทึก' : 'เพิ่มล็อต'}
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
