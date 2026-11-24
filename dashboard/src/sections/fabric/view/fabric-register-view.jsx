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
import { useGetFabricLots, useGetFabricGroups, useGetFabricCategories } from 'src/actions/fabric';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { READER_TAB, ScanReaderTab } from 'src/sections/operations/view/scan-reader-tab';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { LotFormDialog } from './lot-form-dialog';
import { LotManagerCard } from './lot-manager-card';
import { RegisterScanCard } from './register-scan-card';
import { RegisterLotDialog } from './register-lot-dialog';
import { CategoryFormDialog } from './category-form-dialog';
import { CategoryManagerCard } from './category-manager-card';
import { PendingHandheldAlert } from './pending-handheld-alert';
import { EMPTY_TARGET, targetWithLot } from '../register-target';
import { RegisterCategoryDialog } from './register-category-dialog';
import { RegistrationHistoryCard } from './registration-history-card';

// ----------------------------------------------------------------------

const TABS = [
  {
    value: 'scan',
    label: 'ลงทะเบียนผ้า / ล็อต',
    icon: <Iconify icon="solar:t-shirt-bold-duotone" width={22} />,
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

  const reader = useScanReader({
    hospitalId: canUseReader ? hospitalId : null,
    deviceTypes: READER_TYPES,
    points: READER_POINTS,
  });

  const tabs = useTabs('scan');
  // เครื่องอ่านเป็นแท็บที่ 2 — ไม่มีสิทธิ์สั่งเครื่องอ่านก็ไม่มีแท็บนี้
  const visibleTabs = canUseReader ? [TABS[0], READER_TAB, ...TABS.slice(1)] : TABS;
  const categoryDialog = useBoolean();
  const pickCategoryDialog = useBoolean();
  const pickLotDialog = useBoolean();

  // ฟอร์มล็อต — lot = null คือเพิ่มใหม่ (เก็บแยกจาก open ให้ข้อมูลไม่หายระหว่าง popup กำลังปิด)
  const [lotForm, setLotForm] = useState({ open: false, lot: null });
  const openLotForm = (lot = null) => setLotForm({ open: true, lot });

  // ผ้าที่จะลงทะเบียน (ประเภท + ล็อตที่ไม่บังคับ) — อยู่ระดับหน้า เพราะแท็บตั้งค่าล็อตเลือกให้ได้ ("สแกนเข้าล็อต")
  const [target, setTarget] = useState(EMPTY_TARGET);

  useEffect(() => {
    setTarget(EMPTY_TARGET);
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

  // รวมที่ลงทะเบียนจากที่อื่น (เช่น แอดมินอีกคน / Handheld ที่สแกนแล้วเข้าระบบทันที)
  useSocketEvent('fabric:registered', handleRegistered);

  const isScanTab = tabs.value === 'scan';

  // เลือกล็อต — ล็อตหลายประเภท (หรือประเภทที่เลือกไว้ไม่อยู่ในล็อต) ให้เลือกประเภทต่อเลย
  const handleSelectLot = (lot, current = target) => {
    const next = targetWithLot(current, lot);
    setTarget(next.target);
    if (next.needsCategory) pickCategoryDialog.onTrue();
  };

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
            <PendingHandheldAlert
              key={`pending-${hospitalId}`}
              hospitalId={hospitalId}
              canEdit={canEdit}
              onRegistered={handleRegistered}
            />

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
              {visibleTabs.map((tab) => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  icon={tab.icon}
                  iconPosition="start"
                  label={tab.label}
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
                target={target}
                onOpenCategory={pickCategoryDialog.onTrue}
                onOpenLot={pickLotDialog.onTrue}
                reader={reader}
                onOpenReader={() => tabs.setValue(READER_TAB.value)}
                canUseReader={canUseReader}
                canEdit={canEdit}
                active={isScanTab}
                onRegistered={handleRegistered}
                onOpenHistory={() => tabs.setValue('history')}
              />
            </Box>

            {tabs.value === READER_TAB.value && (
              <ScanReaderTab reader={reader} deviceTypes={READER_TYPES} />
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
                onWantNewLot={() => openLotForm()}
                onEditLot={openLotForm}
                onRegisterLot={(lot) => {
                  tabs.setValue('scan');
                  handleSelectLot(lot, EMPTY_TARGET);
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

        <RegisterCategoryDialog
          open={pickCategoryDialog.value}
          onClose={pickCategoryDialog.onFalse}
          lot={lots.find((lot) => lot.id === target.lotId)}
          categories={categories}
          selectedId={target.categoryId}
          onSelect={(category) => setTarget((prev) => ({ ...prev, categoryId: category.id }))}
          canEdit={canEdit}
          onWantNew={categoryDialog.onTrue}
        />

        <RegisterLotDialog
          open={pickLotDialog.value}
          onClose={pickLotDialog.onFalse}
          lots={lots}
          categoryId={target.categoryId}
          selectedId={target.lotId}
          onSelect={(lot) => handleSelectLot(lot)}
          canEdit={canEdit}
          onWantNew={() => openLotForm()}
        />

        <LotFormDialog
          open={lotForm.open}
          onClose={() => setLotForm((prev) => ({ ...prev, open: false }))}
          lot={lotForm.lot}
          categories={categories}
          hospitalId={hospitalId}
          onSaved={refreshLots}
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
