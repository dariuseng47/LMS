'use client';

import { z as zod } from 'zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import CardHeader from '@mui/material/CardHeader';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import CardContent from '@mui/material/CardContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { useBoolean } from 'src/hooks/use-boolean';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  createFabricLot,
  createFabricItem,
  useGetFabricLots,
  createFabricCategory,
  useGetFabricCategories,
} from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';
import { HospitalSelector } from 'src/components/hospital-selector';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

function NewCategoryDialog({ open, onClose, onCreated }) {
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

const NewLotSchema = zod.object({
  lotCode: zod.string().min(1, { message: 'กรอกรหัสล็อต' }),
  purchasedAt: zod.string().optional(),
  quantity: zod.coerce.number().int().positive({ message: 'ต้องมากกว่า 0' }),
});

function RegisterLotCard({ hospitalId, onCreated }) {
  const methods = useForm({
    resolver: zodResolver(NewLotSchema),
    defaultValues: { lotCode: '', purchasedAt: '', quantity: '' },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createFabricLot(data);
      toast.success('เพิ่มล็อตผ้าสำเร็จ — ค่อยผูก EPC รายชิ้นเข้าล็อตนี้ได้ในฟอร์มด้านขวา');
      reset();
      onCreated();
    } catch (error) {
      toast.error(error?.message || 'เพิ่มล็อตไม่สำเร็จ');
    }
  });

  return (
    <Card>
      <CardHeader
        title="ลงทะเบียนล็อตใหม่ (จากการจัดซื้อ)"
        subheader="สร้างหัวล็อตก่อน — ค่อยเพิ่ม EPC รายชิ้นทีหลังตอนติด RFID tag จริง"
      />
      <CardContent>
        <Form methods={methods} onSubmit={onSubmit}>
          <Stack spacing={2.5}>
            <Field.Text name="lotCode" label="รหัสล็อต (เช่น LOT-2026-001)" disabled={!hospitalId} />
            <Field.Text
              name="purchasedAt"
              label="วันที่จัดซื้อ"
              type="date"
              InputLabelProps={{ shrink: true }}
              disabled={!hospitalId}
            />
            <Field.Text name="quantity" label="จำนวนที่สั่งซื้อ" type="number" disabled={!hospitalId} />

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

function buildItemSchema() {
  return zod.object({
    epcCode: zod.string().min(1, { message: 'กรอกรหัส EPC' }),
    fabricCategoryId: zod.coerce.number({ invalid_type_error: 'เลือกหมวดหมู่' }).int().positive(),
    fabricLotId: zod.coerce.number().int().positive().optional().or(zod.literal('')),
    photoUrl: zod.string().optional(),
  });
}

function RegisterItemCard({ hospitalId, categories, lots, onCreated, onWantNewCategory }) {
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
        title="ลงทะเบียนผ้ารายชิ้น"
        subheader='ผูกรหัส EPC จาก RFID tag เข้ากับหมวดหมู่ (และล็อต ถ้ามี) — เริ่มสถานะ "สต๊อกกลาง"'
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

export function FabricRegisterView() {
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin, hospitals, selectedHospitalId, setSelectedHospitalId } =
    useEffectiveHospital();

  const { categories, refreshCategories } = useGetFabricCategories(hospitalId);
  const { lots, refreshLots } = useGetFabricLots(hospitalId);

  const categoryDialog = useBoolean();

  const handleCategoryCreated = useCallback(() => {
    refreshCategories();
  }, [refreshCategories]);

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="xl">
        <CustomBreadcrumbs
          heading="ลงทะเบียนผ้า / ล็อต"
          links={[{ name: 'จัดการผ้าและล็อต' }, { name: 'ลงทะเบียนผ้า / ล็อต' }]}
          action={
            isSuperadmin && (
              <HospitalSelector
                hospitals={hospitals}
                value={selectedHospitalId}
                onChange={setSelectedHospitalId}
              />
            )
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <RegisterLotCard hospitalId={hospitalId} onCreated={refreshLots} />
          </Grid>
          <Grid item xs={12} md={6}>
            <RegisterItemCard
              hospitalId={hospitalId}
              categories={categories}
              lots={lots}
              onCreated={refreshLots}
              onWantNewCategory={categoryDialog.onTrue}
            />
          </Grid>
        </Grid>

        <NewCategoryDialog
          open={categoryDialog.value}
          onClose={categoryDialog.onFalse}
          onCreated={handleCategoryCreated}
        />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
