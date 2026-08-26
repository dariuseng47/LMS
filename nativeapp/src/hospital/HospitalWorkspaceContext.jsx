import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setHospitalScope } from '../api/client';
import { fetchHospitals } from '../api/hospitals.api';
import { useAuth } from '../auth/AuthContext';
import { getStoredHospitalId, setStoredHospitalId } from './hospitalSettings';

// admin/operator ทำงานในโรงพยาบาลตัวเองเสมอ (hospital_id อยู่ใน JWT) — context นี้ไม่มีผลกับเขา
// superadmin ไม่มี tenant ของตัวเอง ต้องเลือกโรงพยาบาลก่อนถึงจะเรียกข้อมูลระดับ tenant ได้
// (ดู docs/multi-tenant-isolation.md) โรงพยาบาลที่เลือกไว้เก็บระดับ global ที่นี่ + จำข้าม session
// ผ่าน SecureStore และ push ค่าลง apiClient ให้แนบไปกับทุก request อัตโนมัติ
const HospitalWorkspaceContext = createContext(null);

export function HospitalWorkspaceProvider({ children }) {
  const { status, user } = useAuth();
  const isSuperadmin = user?.role === 'SUPERADMIN';

  const [hospitals, setHospitals] = useState([]);
  const [hospitalId, setHospitalIdState] = useState(null);
  const [loading, setLoading] = useState(false);
  // ready = พร้อมให้หน้าอื่นเริ่มยิง request ได้ (superadmin ต้องรอจนรู้ hospitalId ก่อน
  // ไม่งั้น request แรกๆ จะโดน server ตีกลับว่า "ต้องระบุ hospitalId")
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (status === 'booting') return undefined;

    if (status !== 'signedIn' || !isSuperadmin) {
      setHospitalScope(null);
      setHospitals([]);
      setHospitalIdState(null);
      setLoading(false);
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setReady(false);

    (async () => {
      const [stored, res] = await Promise.all([
        getStoredHospitalId(),
        fetchHospitals().catch(() => ({ hospitals: [] })),
      ]);
      if (cancelled) return;

      const list = res.hospitals || [];
      setHospitals(list);

      // ค่าที่จำไว้อาจเป็นโรงพยาบาลที่ถูกลบไปแล้ว หรือยังไม่เคยเลือก — default เป็นตัวแรกในรายการ
      const isStoredValid = stored != null && list.some((h) => h.id === stored);
      const next = isStoredValid ? stored : list[0]?.id ?? null;

      setHospitalIdState(next);
      setHospitalScope(next);
      if (next !== stored) await setStoredHospitalId(next);

      setLoading(false);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [status, isSuperadmin]);

  const selectHospital = useCallback(async (id) => {
    setHospitalIdState(id);
    setHospitalScope(id);
    await setStoredHospitalId(id);
  }, []);

  const activeHospital = useMemo(
    () => hospitals.find((h) => h.id === hospitalId) || null,
    [hospitals, hospitalId]
  );

  const value = useMemo(
    () => ({
      isSuperadmin,
      hospitals,
      hospitalId,
      activeHospital,
      loading,
      ready,
      selectHospital,
    }),
    [isSuperadmin, hospitals, hospitalId, activeHospital, loading, ready, selectHospital]
  );

  return (
    <HospitalWorkspaceContext.Provider value={value}>{children}</HospitalWorkspaceContext.Provider>
  );
}

export function useHospitalWorkspace() {
  const ctx = useContext(HospitalWorkspaceContext);
  if (!ctx) throw new Error('useHospitalWorkspace must be used within HospitalWorkspaceProvider');
  return ctx;
}
