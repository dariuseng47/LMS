'use client';

import { useState, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';

import { useTabs } from 'src/hooks/use-tabs';
import { usePermission } from 'src/hooks/use-has-permission';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { varAlpha } from 'src/theme/styles';
import { DashboardContent } from 'src/layouts/dashboard';
import { useGetFabricLots, useGetFabricGroups, useGetFabricCategories } from 'src/actions/fabric';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { ChangeHistoryCard } from './change-history-card';
import { RevertChangeDialog } from './revert-change-dialog';
import { ChangeCategoryCard } from './change-category-card';

// ----------------------------------------------------------------------

const TABS = [
  {
    value: 'change',
    label: 'เปลี่ยนประเภทผ้า',
    icon: <Iconify icon="solar:transfer-horizontal-bold-duotone" width={22} />,
  },
  {
    value: 'history',
    label: 'ประวัติ & ย้อนกลับ',
    icon: <Iconify icon="solar:history-bold-duotone" width={22} />,
  },
];

export function FabricChangeCategoryView() {
  const { hospitalId } = useEffectiveHospital();
  const { can } = usePermission();
  const canEdit = can('web.fabric.change_category.edit');

  const { categories, refreshCategories } = useGetFabricCategories(hospitalId);
  const { groups } = useGetFabricGroups(hospitalId);
  const { lots } = useGetFabricLots(hospitalId);

  const tabs = useTabs('change');
  // เพิ่มทุกครั้งที่มีการเปลี่ยน/ย้อน — ให้แท็บประวัติโหลดข้อมูลใหม่
  const [historyKey, setHistoryKey] = useState(0);
  const [revertBatchId, setRevertBatchId] = useState(null);

  const handleChanged = useCallback(() => {
    setHistoryKey((key) => key + 1);
    refreshCategories();
  }, [refreshCategories]);

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="เปลี่ยนหมวดหมู่ / ประเภทผ้า"
        links={[{ name: 'จัดการผ้าและล็อต' }, { name: 'เปลี่ยนหมวดหมู่ / ประเภทผ้า' }]}
        sx={{ mb: { xs: 3, md: 4 } }}
      />

      <Card sx={{ mb: 3 }}>
        <Tabs
          value={tabs.value}
          onChange={tabs.onChange}
          sx={{
            px: 2.5,
            boxShadow: (theme) =>
              `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
          }}
        >
          {TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} icon={tab.icon} iconPosition="start" label={tab.label} />
          ))}
        </Tabs>
      </Card>

      {tabs.value === 'change' &&
        (canEdit ? (
          <ChangeCategoryCard
            hospitalId={hospitalId}
            groups={groups}
            categories={categories}
            lots={lots}
            onChanged={handleChanged}
            onViewHistory={() => tabs.setValue('history')}
            onRevertRequest={setRevertBatchId}
          />
        ) : (
          <Card sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            บัญชีนี้ดูประวัติได้อย่างเดียว — ต้องได้รับสิทธิ์ &quot;แก้ไข: เปลี่ยนหมวดหมู่ / ประเภทผ้า&quot; จึงจะเปลี่ยนประเภทผ้าได้
          </Card>
        ))}

      {tabs.value === 'history' && (
        <ChangeHistoryCard
          hospitalId={hospitalId}
          canEdit={canEdit}
          refreshKey={historyKey}
          onReverted={handleChanged}
        />
      )}

      <RevertChangeDialog
        open={!!revertBatchId}
        batchId={revertBatchId}
        hospitalId={hospitalId}
        onClose={() => setRevertBatchId(null)}
        onReverted={handleChanged}
      />
    </DashboardContent>
  );
}
