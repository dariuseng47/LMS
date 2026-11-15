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
      summaryByBuilding: data?.summaryByBuilding ?? [],
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

// startDateTime/endDateTime เป็นสตริง 'YYYY-MM-DD HH:mm' — ใช้แท็บ "ประวัติยอดการเติมผ้า" ที่กรอง
// ละเอียดถึงระดับชั่วโมง/นาที คนละตัวกรองกับ useGetRestockReport ด้านบน (ซึ่งกรองแค่ระดับวัน)
export function useGetRestockFillHistory(
  hospitalId,
  { startDateTime, endDateTime, buildingId, wardIds } = {}
) {
  const params = {
    ...(hospitalId ? { hospitalId } : {}),
    ...(startDateTime ? { startDateTime } : {}),
    ...(endDateTime ? { endDateTime } : {}),
    ...(buildingId ? { buildingId } : {}),
    ...(wardIds && wardIds.length > 0 ? { wardIds: wardIds.join(',') } : {}),
  };
  const url = hospitalId ? [endpoints.restockReport.fillHistory, { params }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      range: data?.range,
      days: data?.days ?? [],
      wards: data?.wards ?? [],
      categories: data?.categories ?? [],
      fillHistoryLoading: isLoading,
      fillHistoryError: error,
      refreshFillHistory: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// สถิติผ้าเกิน/ขาด Par + Par แนะนำ ราย (ตู้ x ชนิดผ้า) — แท็บ "วิเคราะห์ Par" และ dialog ตั้ง Par ของตู้
// startDate/endDate 'YYYY-MM-DD' (ไม่ส่ง = 30 วันล่าสุด), cabinetId = ดูเฉพาะตู้เดียว
// enabled=false ไม่ยิง (เช่น dialog ยังไม่เปิด)
export function useGetParAnalysis(
  hospitalId,
  { startDate, endDate, buildingId, wardIds, cabinetId } = {},
  { enabled = true } = {}
) {
  const params = {
    ...(hospitalId ? { hospitalId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(buildingId ? { buildingId } : {}),
    ...(cabinetId ? { cabinetId } : {}),
    ...(wardIds && wardIds.length > 0 ? { wardIds: wardIds.join(',') } : {}),
  };
  const url = hospitalId && enabled ? [endpoints.restockReport.parAnalysis, { params }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      range: data?.range,
      summary: data?.summary ?? {
        roundsAnalyzed: 0,
        overRounds: 0,
        overQtyTotal: 0,
        reduceSuggested: 0,
        increaseSuggested: 0,
        noParCount: 0,
      },
      rows: data?.rows ?? [],
      parAnalysisLoading: isLoading,
      parAnalysisError: error,
      refreshParAnalysis: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// ประวัติ & สถิติผ้าส่งซักใหม่ (แท็บ "ประวัติผ้าส่งซักใหม่") — startDate/endDate 'YYYY-MM-DD'
// (ไม่ส่ง = 30 วันล่าสุด) เลือกตึก/วอร์ด = นับเฉพาะผ้าที่ส่งมาจากตู้ของวอร์ดในขอบเขตนั้น
export function useGetRewashAnalysis(hospitalId, { startDate, endDate, buildingId, wardIds } = {}) {
  const params = {
    ...(hospitalId ? { hospitalId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(buildingId ? { buildingId } : {}),
    ...(wardIds && wardIds.length > 0 ? { wardIds: wardIds.join(',') } : {}),
  };
  const url = hospitalId ? [endpoints.restockReport.rewashAnalysis, { params }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      range: data?.range,
      summary: data?.summary ?? {
        total: 0,
        uniqueItems: 0,
        repeatItemCount: 0,
        openCount: 0,
        washedCount: 0,
        bypassedCount: 0,
        avgTurnaroundHours: null,
        fromWardCount: 0,
        topStatus: null,
        topWard: null,
      },
      byStatus: data?.byStatus ?? [],
      byWard: data?.byWard ?? [],
      byCategory: data?.byCategory ?? [],
      byReason: data?.byReason ?? [],
      trend: data?.trend ?? { granularity: 'day', days: [], series: [] },
      repeatItems: data?.repeatItems ?? [],
      recent: data?.recent ?? [],
      recentTruncated: data?.recentTruncated ?? false,
      rewashLoading: isLoading,
      rewashError: error,
      refreshRewash: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
