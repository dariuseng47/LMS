import { useState, useEffect } from 'react';

import { useGetHospitals } from 'src/actions/hospitals';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

// admin/operator ทำงานในโรงพยาบาลตัวเองเสมอ (มี hospital_id ใน JWT อยู่แล้ว)
// superadmin ไม่มี tenant ของตัวเอง ต้องเลือกโรงพยาบาลก่อนถึงจะดูข้อมูลระดับ tenant ได้
// (ดู docs/multi-tenant-isolation.md — ห้าม default เป็น "ทุก tenant" เงียบๆ)
export function useEffectiveHospital() {
  const { user } = useAuthContext();
  const isSuperadmin = user?.role === 'SUPERADMIN';

  const { hospitals, hospitalsLoading } = useGetHospitals(isSuperadmin);
  const [selectedHospitalId, setSelectedHospitalId] = useState('');

  useEffect(() => {
    if (isSuperadmin && !selectedHospitalId && hospitals.length > 0) {
      setSelectedHospitalId(hospitals[0].id);
    }
  }, [isSuperadmin, hospitals, selectedHospitalId]);

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
