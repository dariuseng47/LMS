'use client';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';

import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { InspectScanCard } from './inspect-scan-card';

// ----------------------------------------------------------------------

// สแกนตรวจสอบผ้า — สแกนผ้าผ่านเครื่องอ่าน RFID จุดตรวจสอบแบบเดียวกับ "สแกนเข้าสต๊อค" แต่ทำงานแบบ
// "สแกนค้นหาผ้า" บน handheld: อ่านอย่างเดียว ไม่บันทึกอะไรลงระบบ ลิสต์ว่าเจอผ้าอะไรบ้าง (สถานะ/ตำแหน่ง/
// รอบซัก) แล้วกดแต่ละชิ้นเปิดโปรไฟล์ผ้า (ประวัติซัก รอบซัก ไทม์ไลน์) ตัวเดียวกับหน้าคลังผ้าทั้งหมด
export function OperationsInspectScanView() {
  const { user } = useAuthContext();
  const { hospitalId } = useEffectiveHospital();

  return (
    <RoleBasedGuard
      hasContent
      currentRole={user?.role}
      acceptRoles={['SUPERADMIN', 'ADMIN', 'OPERATOR']}
    >
      <DashboardContent maxWidth="xl">
        <HospitalContextChip sx={{ mb: 1.5 }} />

        <CustomBreadcrumbs
          heading="สแกนตรวจสอบผ้า"
          links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'สแกนตรวจสอบผ้า' }]}
          sx={{ mb: 2 }}
        />

        {!hospitalId ? (
          <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
        ) : (
          // key = โรงพยาบาล -> สลับโรงพยาบาลแล้วเริ่มรายการใหม่ทั้งหมด (หยุดอ่านต่อเนื่องด้วย)
          <InspectScanCard key={hospitalId} hospitalId={hospitalId} />
        )}
      </DashboardContent>
    </RoleBasedGuard>
  );
}
