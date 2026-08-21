'use client';

import { useCallback } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { useBoolean } from 'src/hooks/use-boolean';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetFabricLots, useGetFabricCategories } from 'src/actions/fabric';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { RegisterLotCard } from './register-lot-card';
import { RegisterItemCard } from './register-item-card';
import { HandheldScanCard } from './handheld-scan-card';
import { NewCategoryDialog } from './new-category-dialog';

// ----------------------------------------------------------------------

export function FabricRegisterView() {
  const { user } = useAuthContext();
  const { hospitalId } = useEffectiveHospital();

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
          action={<HospitalContextChip />}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <RegisterLotCard
              hospitalId={hospitalId}
              categories={categories}
              onCreated={refreshLots}
              onWantNewCategory={categoryDialog.onTrue}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack spacing={3}>
              <HandheldScanCard hospitalId={hospitalId} lots={lots} onConfirmed={refreshLots} />
              <RegisterItemCard
                hospitalId={hospitalId}
                categories={categories}
                lots={lots}
                onCreated={refreshLots}
                onWantNewCategory={categoryDialog.onTrue}
              />
            </Stack>
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
