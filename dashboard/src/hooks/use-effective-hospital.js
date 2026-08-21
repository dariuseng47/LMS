import { useState, useEffect } from 'react';

import { useSearchParams } from 'src/routes/hooks';

import { useGetHospitals } from 'src/actions/hospitals';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

// admin/operator ทำงานในโรงพยาบาลตัวเองเสมอ (มี hospital_id ใน JWT อยู่แล้ว)
// superadmin ไม่มี tenant ของตัวเอง ต้องเลือกโรงพยาบาลก่อนถึงจะดูข้อมูลระดับ tenant ได้
// (ดู docs/multi-tenant-isolation.md — ห้าม default เป็น "ทุก tenant" เงียบๆ)
//
// รองรับ query param ?hospitalId= เป็นค่าเริ่มต้น (เผื่อ superadmin คลิกเข้ามาจากหน้ารายละเอียด
// โรงพยาบาลหนึ่งแล้วอยากให้หน้าอื่น เช่น ผู้ใช้งาน/โครงสร้าง preselect โรงพยาบาลเดิมให้เลย)
// ถ้าไม่มี query param พฤติกรรมเดิมทั้งหมดคงเดิม (fallback ไปที่ hospitals[0])
export function useEffectiveHospital() {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();
  const isSuperadmin = user?.role === 'SUPERADMIN';

  const { hospitals, hospitalsLoading } = useGetHospitals(isSuperadmin);
  const [selectedHospitalId, setSelectedHospitalId] = useState('');

  const hospitalIdFromUrl = searchParams.get('hospitalId');

  useEffect(() => {
    if (!isSuperadmin || selectedHospitalId || hospitals.length === 0) return;

    const fromUrl = hospitalIdFromUrl ? Number(hospitalIdFromUrl) : null;
    const isValidUrlId = fromUrl && hospitals.some((h) => h.id === fromUrl);

    setSelectedHospitalId(isValidUrlId ? fromUrl : hospitals[0].id);
  }, [isSuperadmin, hospitals, selectedHospitalId, hospitalIdFromUrl]);

  const hospitalId = isSuperadmin ? selectedHospitalId : user?.hospital_id;

  return {
    hospitalId,
    isSuperadmin,
    hospitals,
    hospitalsLoading,
    selectedHospitalId,
    setSelectedHospitalId,
  };
}
