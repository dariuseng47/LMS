'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { DashboardContent } from 'src/layouts/dashboard';

import { HospitalDetailView } from 'src/sections/hq/view';

// ----------------------------------------------------------------------

// หน้ารายละเอียดโรงพยาบาล — เดิมเป็น /dashboard/hq/hospitals/[id] แต่ dashboard ถูก export เป็นไฟล์ static
// (next.config.mjs → output: 'export') ซึ่งต้องรู้ทุก id ตั้งแต่ตอน build ไม่ได้ เลยรับ id ทาง query แทน:
// /dashboard/hq/hospitals/detail/?id=5 (ใช้ paths.dashboard.hq.hospitalDetails(id) สร้างลิงก์)
// useSearchParams ต้องอยู่ใน <Suspense> ไม่งั้น static export build ไม่ผ่าน
function HospitalDetailPage() {
  const searchParams = useSearchParams();
  const hospitalId = Number(searchParams.get('id'));

  return (
    <DashboardContent maxWidth="xl">
      <HospitalDetailView hospitalId={hospitalId} />
    </DashboardContent>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HospitalDetailPage />
    </Suspense>
  );
}
