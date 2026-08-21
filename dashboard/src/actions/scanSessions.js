import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export async function triggerScanSession(payload) {
  const { data } = await axios.post(endpoints.scanSessions.list, payload);
  return data;
}

// โพลทุก 3 วิระหว่างที่ session ยังไม่จบ (PENDING/SCANNING/REPORTED) — รอวันที่มี real-time
// socket subscription ฝั่ง dashboard ค่อยเปลี่ยนมาใช้ event แทนการโพล
export function useGetScanSession(sessionId, hospitalId) {
  const url = sessionId
    ? [endpoints.scanSessions.details(sessionId), { params: hospitalId ? { hospitalId } : {} }]
    : '';

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: (latestData) =>
      latestData?.session && ['CONFIRMED', 'CANCELLED'].includes(latestData.session.status)
        ? 0
        : 3000,
  });

  return useMemo(
    () => ({
      session: data?.session,
      sessionLoading: isLoading,
      sessionError: error,
      refreshSession: mutate,
    }),
    [data?.session, error, isLoading, mutate]
  );
}

export async function confirmScanSession(id, payload = {}) {
  const { data } = await axios.post(endpoints.scanSessions.confirm(id), payload);
  return data;
}

export async function cancelScanSession(id) {
  await axios.post(endpoints.scanSessions.cancel(id));
}
