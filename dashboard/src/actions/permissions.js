import { useMemo } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';

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
      scopes: data?.scopes || [],
      handheldEnabled: data?.handheldEnabled ?? true,
      canManageSubordinates: data?.canManageSubordinates ?? false,
      permissionsLoading: isLoading,
      permissionsError: error,
      refreshPermissions: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

export function useGetMyPermissions() {
  const { data, isLoading, error, mutate } = useSWR(
    endpoints.users.myPermissions,
    fetcher,
    swrOptions
  );

  return useMemo(
    () => ({
      myPermissions: data?.permissions || [],
      myPermissionsLoading: isLoading,
      myPermissionsError: error,
      refreshMyPermissions: mutate,
    }),
    [data?.permissions, error, isLoading, mutate]
  );
}

export async function updateUserPermissions(userId, overrides) {
  const { data } = await axios.put(endpoints.users.permissions(userId), { overrides });
  return data;
}

// ทิ้งสิทธิ์ที่ cache ไว้ของ user นี้ (เช่น หลังเปลี่ยนบทบาท สิทธิ์ถูกรีเซ็ตทั้งชุด) — swrOptions ด้านบนปิด
// revalidateIfStale ไว้ ถ้าไม่ล้าง เปิดหน้าตั้งค่าสิทธิ์ครั้งถัดไปจะได้ของบทบาทเดิม
export function clearUserPermissionsCache(userId) {
  return globalMutate(endpoints.users.permissions(userId), undefined, { revalidate: false });
}
