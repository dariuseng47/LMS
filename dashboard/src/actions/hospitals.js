import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetHospitals() {
  const { data, isLoading, error, isValidating, mutate } = useSWR(
    endpoints.hospitals.list,
    fetcher,
    swrOptions
  );

  const memoizedValue = useMemo(
    () => ({
      hospitals: data?.hospitals || [],
      hospitalsLoading: isLoading,
      hospitalsError: error,
      hospitalsValidating: isValidating,
      hospitalsEmpty: !isLoading && !data?.hospitals.length,
      refreshHospitals: mutate,
    }),
    [data?.hospitals, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}

export async function createHospital(payload) {
  const { data } = await axios.post(endpoints.hospitals.list, payload);
  return data;
}

export async function updateHospital(id, payload) {
  const { data } = await axios.patch(endpoints.hospitals.details(id), payload);
  return data;
}

export function useDashboardSummary(hospitalId) {
  const url = hospitalId ? endpoints.hospitals.dashboardSummary(hospitalId) : '';

  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, swrOptions);

  const memoizedValue = useMemo(
    () => ({
      summary: data,
      summaryLoading: isLoading,
      summaryError: error,
      summaryValidating: isValidating,
      refreshSummary: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );

  return memoizedValue;
}
