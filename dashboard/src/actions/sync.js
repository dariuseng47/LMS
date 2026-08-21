import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetSyncConflicts() {
  const { data, isLoading, error, mutate } = useSWR(endpoints.sync.conflicts, fetcher, swrOptions);

  return useMemo(
    () => ({
      conflicts: data?.conflicts || [],
      conflictsLoading: isLoading,
      conflictsError: error,
      conflictsEmpty: !isLoading && !data?.conflicts.length,
      refreshConflicts: mutate,
    }),
    [data?.conflicts, error, isLoading, mutate]
  );
}

export async function approveSyncConflict(id, chosen) {
  await axios.post(endpoints.sync.approve(id), { chosen });
}
