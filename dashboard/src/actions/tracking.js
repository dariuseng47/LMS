import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetLocationByEpc(epcCode, hospitalId) {
  const url = epcCode
    ? [endpoints.tracking.location(epcCode), { params: hospitalId ? { hospitalId } : {} }]
    : '';

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      fabricItem: data?.fabricItem,
      location: data?.location,
      lastScan: data?.lastScan,
      locationLoading: isLoading,
      locationError: error,
      refreshLocation: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}
