import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

// โพลทุก 30 วิ จำลอง near-real-time เพราะยังไม่มี Socket.io infra ในระบบ
export function useGetAlerts(hospitalId) {
  const url = hospitalId ? [endpoints.alerts.list, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 30000,
  });

  return useMemo(
    () => ({
      statusTimeout: data?.statusTimeout || [],
      parLevel: data?.parLevel || [],
      deviceOffline: data?.deviceOffline || [],
      weakSignal: data?.weakSignal || [],
      stepSkipped: data?.stepSkipped || [],
      alertsLoading: isLoading,
      alertsError: error,
      refreshAlerts: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
