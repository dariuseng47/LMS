import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetUserPermissions(userId) {
  const url = userId ? endpoints.users.permissions(userId) : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      permissions: data?.permissions || [],
      permissionsLoading: isLoading,
      permissionsError: error,
      refreshPermissions: mutate,
    }),
    [data?.permissions, error, isLoading, mutate]
  );
}

export async function updateUserPermissions(userId, overrides) {
  const { data } = await axios.put(endpoints.users.permissions(userId), { overrides });
  return data;
}
