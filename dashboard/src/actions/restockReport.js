import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// startDate/endDate เป็นสตริง 'YYYY-MM-DD' — กรอง history/summaryByWard เท่านั้น
// (dailyChart/forecast ฝั่ง server ใช้ 30 วันล่าสุดเสมอ ไม่ผูกกับตัวกรองนี้)
export function useGetRestockReport(hospitalId, { startDate, endDate } = {}) {
  const params = {
    ...(hospitalId ? { hospitalId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
  const url = hospitalId ? [endpoints.restockReport.get, { params }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      range: data?.range,
      totals: data?.totals ?? { totalEvents: 0, totalTransfers: 0, totalRounds: 0 },
      history: data?.history ?? [],
      summaryByWard: data?.summaryByWard ?? [],
      rounds: data?.rounds ?? [],
      dailyChart: data?.dailyChart ?? { days: [], series: [] },
      forecast: data?.forecast ?? [],
      reportLoading: isLoading,
      reportError: error,
      refreshReport: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
