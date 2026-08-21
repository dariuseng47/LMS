'use client';

import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  holdFabricItem,
  useGetFabricItems,
  decommissionFabricItem,
  useGetFabricItemDetail,
} from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field } from 'src/components/hook-form';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import {
  STATUS_LABEL,
  STATUS_COLOR,
  REASON_CODE_OPTIONS,
  MAX_PHOTO_SIZE_BYTES,
} from '../fabric-constants';

// ----------------------------------------------------------------------

const ActionSchema = zod.object({
  epcCode: zod.string().min(1, { message: 'กรอกรหัส EPC' }),
  reasonCode: zod.string().min(1, { message: 'เลือกเหตุผล' }),
  // react-dropzone ยิง onDrop มาพร้อม acceptedFiles ว่างเปล่าด้วยตอนไฟล์โดน reject (เช่น เกิน
  // 2MB) ทำให้ค่า field กลายเป็น undefined ไม่ใช่ null — ต้องรับทั้งสองแบบ ไม่งั้นจะเห็น error
  // message ดิบของ zod ("Input not instance of File") ซ้อนกับกล่อง rejection ของ dropzone เอง
  photo: zod
    .instanceof(File)
    .nullable()
    .optional()
    .refine((file) => !file || file.size <= MAX_PHOTO_SIZE_BYTES, {
      message: 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 2MB',
    }),
});

function HoldActionCard({ hospitalId, onDone }) {
  const [lookupEpc, setLookupEpc] = useState('');
  const { fabricItem, detailLoading } = useGetFabricItemDetail(lookupEpc || undefined, hospitalId);

  const methods = useForm({
    resolver: zodResolver(ActionSchema),
    defaultValues: { epcCode: '', reasonCode: '', photo: null },
  });
  const {
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting },
  } = methods;

  const epcCode = watch('epcCode');

  const handleLookup = useCallback(() => setLookupEpc(epcCode), [epcCode]);

  const runAction = (action) =>
    handleSubmit(async (data) => {
      if (!fabricItem) {
        toast.error('กรุณาค้นหาและยืนยันรหัส EPC ก่อน');
        return;
      }
      try {
        let payload;
        if (data.photo instanceof File) {
          payload = new FormData();
          payload.append('reasonCode', data.reasonCode);
          payload.append('photo', data.photo);
        } else {
          payload = { reasonCode: data.reasonCode };
        }

        if (action === 'hold') {
          await holdFabricItem(fabricItem.id, payload);
          toast.success('พักผ้าชิ้นนี้สำเร็จ');
        } else {
          await decommissionFabricItem(fabricItem.id, payload);
          toast.success('แทงชำรุดผ้าชิ้นนี้สำเร็จ');
        }
        reset();
        setLookupEpc('');
        onDone();
      } catch (error) {
        toast.error(error?.message || 'ดำเนินการไม่สำเร็จ');
      }
    });

  return (
    <Card>
      <CardHeader title="พัก / แทงชำรุดผ้า" subheader="ค้นหาด้วยรหัส EPC แล้วเลือกการดำเนินการ" />
      <CardContent>
        <Form methods={methods}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1}>
              <Field.Text name="epcCode" label="รหัส EPC" disabled={!hospitalId} fullWidth />
              <Button type="button" variant="outlined" onClick={handleLookup} sx={{ flexShrink: 0 }}>
                ค้นหา
              </Button>
            </Stack>

            {detailLoading && lookupEpc && <LoadingScreen sx={{ height: 80 }} />}

            {fabricItem && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.neutral' }}
              >
                <Typography variant="body2">พบผ้า: {fabricItem.epc_code} — สถานะปัจจุบัน</Typography>
                <Chip
                  size="small"
                  variant="soft"
                  color={STATUS_COLOR[fabricItem.status]}
                  label={STATUS_LABEL[fabricItem.status] ?? fabricItem.status}
                />
              </Stack>
            )}

            <Field.Select name="reasonCode" label="เหตุผล" disabled={!hospitalId}>
              {REASON_CODE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Field.Select>

            <Stack spacing={1}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                รูปภาพประกอบ (ถ้ามี)
              </Typography>
              <Field.Upload
                name="photo"
                maxSize={MAX_PHOTO_SIZE_BYTES}
                disabled={!hospitalId}
                onDelete={() => methods.setValue('photo', null, { shouldValidate: true })}
                helperText="รองรับไฟล์ JPG, PNG, WEBP ขนาดไม่เกิน 2MB"
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <LoadingButton
                type="button"
                variant="contained"
                color="warning"
                loading={isSubmitting}
                disabled={!fabricItem}
                onClick={runAction('hold')}
              >
                พักใช้งาน
              </LoadingButton>
              <LoadingButton
                type="button"
                variant="contained"
                color="error"
                loading={isSubmitting}
                disabled={!fabricItem}
                onClick={runAction('decommission')}
              >
                แทงชำรุด
              </LoadingButton>
            </Stack>
          </Stack>
        </Form>
      </CardContent>
    </Card>
  );
}

export function FabricHoldView() {
  const { user } = useAuthContext();
  const { hospitalId } = useEffectiveHospital();

  const { fabricItems, fabricItemsLoading, fabricItemsEmpty, refreshFabricItems } = useGetFabricItems({
    hospitalId,
    status: 'HOLD',
  });

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN', 'OPERATOR']}>
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="รายการพัก & ชำรุด"
          links={[{ name: 'จัดการผ้าและล็อต' }, { name: 'รายการพัก & ชำรุด' }]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Stack spacing={3}>
          <HoldActionCard hospitalId={hospitalId} onDone={refreshFabricItems} />

          <Card>
            <CardHeader title="ผ้าที่พักใช้งานอยู่ตอนนี้" />
            {!hospitalId ? (
              <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 8 }} />
            ) : fabricItemsLoading ? (
              <LoadingScreen sx={{ height: 200 }} />
            ) : fabricItemsEmpty ? (
              <EmptyContent title="ไม่มีผ้าพักใช้งานอยู่ในขณะนี้" sx={{ py: 8 }} />
            ) : (
              <Scrollbar>
                <TableContainer sx={{ minWidth: 560 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>รหัส EPC</TableCell>
                        <TableCell>รอบซัก</TableCell>
                        <TableCell>อัปเดตล่าสุด</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {fabricItems.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{item.epc_code}</TableCell>
                          <TableCell>{item.wash_count}</TableCell>
                          <TableCell>{new Date(item.updated_at).toLocaleString('th-TH')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Scrollbar>
            )}
          </Card>
        </Stack>
      </DashboardContent>
    </RoleBasedGuard>
  );
}
