import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetDevices(hospitalId, deviceType) {
  const params = { ...(hospitalId ? { hospitalId } : {}), ...(deviceType ? { deviceType } : {}) };
  const url = [endpoints.devices.list, { params }];

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      devices: data?.devices || [],
      devicesLoading: isLoading,
      devicesError: error,
      refreshDevices: mutate,
    }),
    [data?.devices, error, isLoading, mutate]
  );
}

export async function createDevice(payload) {
  const { data } = await axios.post(endpoints.devices.list, payload);
  return data;
}
