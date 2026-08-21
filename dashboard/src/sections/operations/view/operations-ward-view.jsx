'use client';

import { z as zod } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { useTabs } from 'src/hooks/use-tabs';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { varAlpha } from 'src/theme/styles';
import { useGetCabinets } from 'src/actions/cabinets';
import { DashboardContent } from 'src/layouts/dashboard';
import { wardIssueScan, wardReceiveScan } from 'src/actions/scans';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { STATUS_LABEL, STATUS_COLOR } from '../../fabric/fabric-constants';

// ----------------------------------------------------------------------

const MODES = [
  { value: 'issue', label: 'จ่ายผ้าไปวอร์ด', icon: <Iconify icon="solar:delivery-bold-duotone" width={22} /> },
  { value: 'receive', label: 'รับผ้าคืน', icon: <Iconify icon="solar:box-bold-duotone" width={22} /> },
];

const WardSchema = zod.object({
  epcCode: zod.string().min(1, { message: 'กรอกรหัส EPC' }),
  cabinetId: zod.union([zod.string(), zod.number()]).optional(),
});

export function OperationsWardView() {
  const { user } = useAuthContext();
  const { hospitalId } = useEffectiveHospital();
  const tabs = useTabs('issue');

  const { cabinets, cabinetsLoading } = useGetCabinets(hospitalId);
  const [recent, setRecent] = useState([]);

  const methods = useForm({
    resolver: zodResolver(WardSchema),
    defaultValues: { epcCode: '', cabinetId: '' },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    if (tabs.value === 'issue' && !data.cabinetId) {
      toast.error('กรุณาเลือกตู้ปลายทาง');
      return;
    }

    try {
      const result =
        tabs.value === 'issue'
          ? await wardIssueScan({ epcCode: data.epcCode, cabinetId: data.cabinetId })
          : await wardReceiveScan({ epcCode: data.epcCode });

      toast.success(`${result.epcCode} → ${STATUS_LABEL[result.status] ?? result.status}`);
      setRecent((prev) => [{ ...result, mode: tabs.value, at: Date.now() }, ...prev].slice(0, 10));
      // เก็บตู้ปลายทางเดิมไว้ — operator มักจ่ายผ้าหลายชิ้นเข้าตู้เดียวกันต่อเนื่องกัน
      reset({ epcCode: '', cabinetId: data.cabinetId });
    } catch (error) {
      toast.error(error?.message || 'ดำเนินการไม่สำเร็จ');
    }
  });

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN', 'OPERATOR']}>
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="รับ-ส่งผ้าประจำวอร์ด"
          links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'รับ-ส่งผ้าประจำวอร์ด' }]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Stack spacing={3}>
          <Card>
            <Tabs
              value={tabs.value}
              onChange={tabs.onChange}
              sx={{
                px: 2.5,
                boxShadow: (theme) =>
                  `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
              }}
            >
              {MODES.map((mode) => (
                <Tab
                  key={mode.value}
                  value={mode.value}
                  icon={mode.icon}
                  iconPosition="start"
                  label={mode.label}
                />
              ))}
            </Tabs>

            <CardContent>
              {!hospitalId ? (
                <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 4 }} />
              ) : (
                <Form methods={methods} onSubmit={onSubmit}>
                  <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
                    {tabs.value === 'issue' && (
                      <Field.Select name="cabinetId" label="ตู้ปลายทาง" disabled={cabinetsLoading}>
                        {cabinets.map((cabinet) => (
                          <MenuItem key={cabinet.id} value={cabinet.id}>
                            {cabinet.name}
                          </MenuItem>
                        ))}
                      </Field.Select>
                    )}

                    <Field.Text name="epcCode" label="รหัส EPC" placeholder="สแกนหรือกรอกรหัส EPC" />

                    <LoadingButton
                      type="submit"
                      variant="contained"
                      loading={isSubmitting}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {tabs.value === 'issue' ? 'ยืนยันจ่ายผ้า' : 'ยืนยันรับผ้าคืน'}
                    </LoadingButton>
                  </Stack>
                </Form>
              )}
            </CardContent>
          </Card>

          {recent.length > 0 && (
            <Card>
              <CardHeader title="รายการล่าสุด" />
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>รหัส EPC</TableCell>
                      <TableCell>การดำเนินการ</TableCell>
                      <TableCell>สถานะใหม่</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recent.map((entry) => (
                      <TableRow key={`${entry.epcCode}-${entry.at}`}>
                        <TableCell>{entry.epcCode}</TableCell>
                        <TableCell>{entry.mode === 'issue' ? 'จ่ายไปวอร์ด' : 'รับคืน'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="soft"
                            color={STATUS_COLOR[entry.status]}
                            label={STATUS_LABEL[entry.status] ?? entry.status}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
        </Stack>
      </DashboardContent>
    </RoleBasedGuard>
  );
}
