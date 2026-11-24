'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import { useTabs } from 'src/hooks/use-tabs';
import { useBoolean } from 'src/hooks/use-boolean';
import { useScanReader } from 'src/hooks/use-scan-reader';
import { useSocketEvent } from 'src/hooks/use-socket-event';
import { usePermission } from 'src/hooks/use-has-permission';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { varAlpha } from 'src/theme/styles';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetScanSessions } from 'src/actions/scanSessions';
import { useGetFabricLots, useGetFabricGroups, useGetFabricCategories } from 'src/actions/fabric';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { EMPTY_TARGET } from '../register-target';
import { LotFormDialog } from './lot-form-dialog';
import { LotManagerCard } from './lot-manager-card';
import { RegisterScanCard } from './register-scan-card';
import { HandheldScanCard } from './handheld-scan-card';
import { CategoryFormDialog } from './category-form-dialog';
import { CategoryManagerCard } from './category-manager-card';
import { RegisterTargetDialog } from './register-target-dialog';
import { RegistrationHistoryCard } from './registration-history-card';

// ----------------------------------------------------------------------

const TABS = [
  {
    value: 'scan',
    label: 'ลงทะเบียนผ้า / ล็อต',
    icon: <Iconify icon="solar:t-shirt-bold-duotone" width={22} />,
  },
  {
    value: 'handheld',
    label: 'สแกนด้วย Handheld',
    icon: <Iconify icon="solar:smartphone-bold-duotone" width={22} />,
  },
  {
    value: 'history',
    label: 'ประวัติการลงทะเบียนผ้า',
    icon: <Iconify icon="solar:history-bold-duotone" width={22} />,
  },
  {
    value: 'lot',
    label: 'ตั้งค่าล็อต',
    icon: <Iconify icon="solar:box-bold-duotone" width={22} />,
  },
  {
    value: 'category',
    label: 'ตั้งค่าหมวดหมู่, ประเภทผ้า',
    icon: <Iconify icon="solar:tag-bold-duotone" width={22} />,
  },
];

// สแกนลงทะเบียนได้ทั้งสองจุด (server สั่งอ่านได้ทั้งคู่ — ดู rfidReader.controller.js#scanCheckpoint)
const READER_TYPES = ['WEIGHT_GATE', 'RFID_CHECKPOINT'];
const READER_POINTS = ['FABRIC_REGISTER'];

export function FabricRegisterView() {
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin, hospitals } = useEffectiveHospital();
  // ใส่ชื่อโรงพยาบาลลงในรายงาน export (ดู pattern เดียวกันใน operations-restock-report-view.jsx)
  const hospitalName = isSuperadmin
    ? hospitals.find((h) => h.id === hospitalId)?.name
    : user?.hospital_name;

  // สั่งเครื่องอ่านผูกกับสิทธิ์เมนู "อุปกรณ์ & สัญญาณ RFID" — ไม่มีสิทธิ์ = พิมพ์/วางรหัส EPC ได้อย่างเดียว
  const { can } = usePermission();
  const canUseReader = can('web.devices.view');
  const canEdit = can('web.fabric.register.edit');

  const { categories, categoriesLoading, refreshCategories } = useGetFabricCategories(hospitalId);
  const { groups, groupsLoading, refreshGroups } = useGetFabricGroups(hospitalId);
  const { lots, lotsLoading, refreshLots } = useGetFabricLots(hospitalId);
  const { sessions, refreshSessions } = useGetScanSessions(hospitalId);

  const reader = useScanReader({
    hospitalId: canUseReader ? hospitalId : null,
    deviceTypes: READER_TYPES,
    points: READER_POINTS,
  });

  const tabs = useTabs('scan');
  const lotDialog = useBoolean();
  const categoryDialog = useBoolean();

  // ผ้าที่จะลงทะเบียน — แยกกันคนละค่าระหว่างแท็บสแกนกับแท็บ Handheld ใช้ popup เลือกตัวเดียวกัน
  const [scanTarget, setScanTarget] = useState(EMPTY_TARGET);
  const [handheldTarget, setHandheldTarget] = useState(EMPTY_TARGET);
  const [targetDialog, setTargetDialog] = useState({ open: false, forHandheld: false });

  useEffect(() => {
    setScanTarget(EMPTY_TARGET);
    setHandheldTarget(EMPTY_TARGET);
  }, [hospitalId]);

  // ลงทะเบียนสำเร็จ -> ยอดต่อล็อต/ต่อประเภทเปลี่ยน
  const handleRegistered = useCallback(() => {
    refreshLots();
    refreshCategories();
  }, [refreshLots, refreshCategories]);

  const handleCategoryCreated = useCallback(() => {
    refreshCategories();
    refreshGroups();
  }, [refreshCategories, refreshGroups]);

  // รวมที่ลงทะเบียนจากที่อื่น (เช่น แอดมินอีกคน / ยืนยันรอบ Handheld จากอีกหน้าจอ)
  useSocketEvent('fabric:registered', handleRegistered);
  useSocketEvent('scan:reported', () => refreshSessions());

  const reportedCount = sessions.filter((s) => s.status === 'REPORTED').length;
  const isScanTab = tabs.value === 'scan';

  const openTargetDialog = (forHandheld) => setTargetDialog({ open: true, forHandheld });

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN', 'ADMIN']}>
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="ลงทะเบียนผ้า / ล็อต"
          links={[{ name: 'จัดการผ้าและล็อต' }, { name: 'ลงทะเบียนผ้า / ล็อต' }]}
          // แท็บสแกนใช้บนจอทัชแบบพอดีจอ — ลดช่องว่างด้านบนให้พื้นที่สแกนเหลือมากที่สุด
          sx={{ mb: isScanTab ? 2 : { xs: 3, md: 4 } }}
        />

        {!hospitalId ? (
          <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
        ) : (
          <>
            <Tabs
              value={tabs.value}
              onChange={tabs.onChange}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{
                mb: isScanTab ? 2 : 3,
                boxShadow: (t) =>
                  `inset 0 -2px 0 0 ${varAlpha(t.vars.palette.grey['500Channel'], 0.08)}`,
              }}
            >
              {TABS.map((tab) => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  icon={tab.icon}
                  iconPosition="start"
                  label={
                    tab.value === 'handheld' && reportedCount > 0 ? (
                      <Box component="span" sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
                        {tab.label}
                        <Label color="error" variant="filled">
                          {reportedCount}
                        </Label>
                      </Box>
                    ) : (
                      tab.label
                    )
                  }
                />
              ))}
            </Tabs>

            {/* ซ่อนแทนการถอดออก — สลับไปแท็บอื่น (เช่น เพิ่มล็อต) แล้วรายการที่สแกนไว้ยังอยู่
                key = โรงพยาบาล -> สลับโรงพยาบาลแล้วเริ่มรายการใหม่ทั้งหมด (หยุดอ่านต่อเนื่องด้วย) */}
            <Box sx={{ display: isScanTab ? 'block' : 'none' }}>
              <RegisterScanCard
                key={hospitalId}
                hospitalId={hospitalId}
                lots={lots}
                categories={categories}
                target={scanTarget}
                onOpenTarget={() => openTargetDialog(false)}
                reader={reader}
                readerTypes={READER_TYPES}
                canUseReader={canUseReader}
                canEdit={canEdit}
                active={isScanTab}
                onRegistered={handleRegistered}
                onOpenHistory={() => tabs.setValue('history')}
              />
            </Box>

            {tabs.value === 'handheld' && (
              <HandheldScanCard
                hospitalId={hospitalId}
                lots={lots}
                categories={categories}
                sessions={sessions}
                target={handheldTarget}
                onOpenTarget={() => openTargetDialog(true)}
                canEdit={canEdit}
                onSessionsChanged={refreshSessions}
                onConfirmed={handleRegistered}
              />
            )}

            {tabs.value === 'history' && (
              <RegistrationHistoryCard
                key={hospitalId}
                hospitalId={hospitalId}
                hospitalName={hospitalName}
                categories={categories}
              />
            )}

            {tabs.value === 'lot' && (
              <LotManagerCard
                hospitalName={hospitalName}
                lots={lots}
                lotsLoading={lotsLoading}
                canEdit={canEdit}
                onWantNewLot={lotDialog.onTrue}
                onRegisterLot={(lot) => {
                  setScanTarget({ lotId: lot.id, categoryId: null });
                  tabs.setValue('scan');
                  // ล็อตยังไม่ตั้งประเภทผ้า -> ให้เลือกประเภทต่อเลย
                  if (!lot.fabric_category_id) openTargetDialog(false);
                }}
              />
            )}

            {tabs.value === 'category' && (
              <CategoryManagerCard
                hospitalId={hospitalId}
                groups={groups}
                groupsLoading={groupsLoading}
                categories={categories}
                categoriesLoading={categoriesLoading}
                canEdit={canEdit}
                onGroupsChanged={refreshGroups}
                onCategoriesChanged={refreshCategories}
              />
            )}
          </>
        )}

        <RegisterTargetDialog
          open={targetDialog.open}
          onClose={() => setTargetDialog((prev) => ({ ...prev, open: false }))}
          lots={lots}
          categories={categories}
          target={targetDialog.forHandheld ? handheldTarget : scanTarget}
          onSelect={targetDialog.forHandheld ? setHandheldTarget : setScanTarget}
          requireLotCategory={targetDialog.forHandheld}
          canEdit={canEdit}
          onWantNewLot={lotDialog.onTrue}
          onWantNewCategory={categoryDialog.onTrue}
        />

        <LotFormDialog
          open={lotDialog.value}
          onClose={lotDialog.onFalse}
          categories={categories}
          hospitalId={hospitalId}
          onCreated={refreshLots}
          onWantNewCategory={categoryDialog.onTrue}
        />

        <CategoryFormDialog
          open={categoryDialog.value}
          onClose={categoryDialog.onFalse}
          mode="create"
          groups={groups}
          hospitalId={hospitalId}
          onSaved={handleCategoryCreated}
        />
      </DashboardContent>
    </RoleBasedGuard>
  );
}
