import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

// รอบสแกน Handheld ที่ค้างรออนุมัติจากระบบเดิม (REPORTED) — ปัจจุบันส่งผลจากเครื่องแล้วลงทะเบียนทันที
// รายการนี้จึงมีแค่ของเก่า (หรือ server ยังเป็นเวอร์ชันเดิม) ดู pending-handheld-alert.jsx
export function useGetPendingScanSessions(hospitalId) {
  const url = hospitalId
    ? [endpoints.scanSessions.list, { params: { hospitalId, status: 'REPORTED' } }]
    : null;

  const { data, mutate } = useSWR(url, fetcher, { revalidateOnFocus: false });

  return useMemo(
    () => ({ pendingSessions: data?.sessions ?? [], refreshPendingSessions: mutate }),
    [data?.sessions, mutate]
  );
}

export async function confirmScanSession(id) {
  const { data } = await axios.post(endpoints.scanSessions.confirm(id), {});
  return data; // { created, skipped }
}

export async function cancelScanSession(id) {
  await axios.post(endpoints.scanSessions.cancel(id));
}
