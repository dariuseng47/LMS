import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export async function triggerScanSession(payload) {
  const { data } = await axios.post(endpoints.scanSessions.list, payload);
  return data;
}

// รายการ session ที่ยังค้าง (PENDING/SCANNING/REPORTED) — ให้แอดมินเห็นทั้งที่เริ่มจากเครื่อง handheld เอง
// และที่สั่งจากหน้าเว็บ แล้วกดยืนยันได้ ไม่งั้นผ้าที่สแกนมาจะค้างสถานะ REPORTED ไม่เข้าคลังผ้า
// โพลทุก 10 วิ เผื่อ socket หลุด (ปกติรีเฟรชทันทีจาก event scan:* ดู handheld-scan-card.jsx)
export function useGetScanSessions(hospitalId) {
  // superadmin ต้องเลือกโรงพยาบาลก่อน (resolveTenantId บังคับ ?hospitalId=) — ยังไม่รู้ก็อย่ายิง
  const url = hospitalId ? [endpoints.scanSessions.list, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 10000,
  });

  return useMemo(
    () => ({
      sessions: data?.sessions ?? [],
      sessionsLoading: isLoading,
      sessionsError: error,
      refreshSessions: mutate,
    }),
    [data?.sessions, error, isLoading, mutate]
  );
}

export async function confirmScanSession(id, payload = {}) {
  const { data } = await axios.post(endpoints.scanSessions.confirm(id), payload);
  return data;
}

export async function cancelScanSession(id) {
  await axios.post(endpoints.scanSessions.cancel(id));
}
