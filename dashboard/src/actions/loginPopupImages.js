import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function useGetLoginPopupImages() {
  const { data, isLoading, error, mutate } = useSWR(endpoints.loginPopupImages.list, fetcher, swrOptions);

  return useMemo(
    () => ({
      images: data?.images ?? [],
      imagesLoading: isLoading,
      imagesError: error,
      refreshImages: mutate,
    }),
    [data?.images, error, isLoading, mutate]
  );
}

// key เป็น null ตอนยังไม่ต้องเรียก (เช่น ยังไม่ผ่านเงื่อนไข "เพิ่ง login สำเร็จ") — SWR จะไม่ยิง request
export function useGetLoginPopupImagesForMe(shouldFetch) {
  const { data, isLoading, error } = useSWR(
    shouldFetch ? endpoints.loginPopupImages.forMe : null,
    fetcher,
    swrOptions
  );

  return useMemo(
    () => ({
      images: data?.images ?? [],
      imagesLoading: isLoading,
      imagesError: error,
    }),
    [data?.images, error, isLoading]
  );
}

// onUploadProgress = (percent: number) => void — ให้ UI แสดงแถบ % ระหว่างรออัปโหลดรูป (อาจใช้เวลา
// นานกว่าปกติเพราะไฟล์รูปหนักกว่า payload อื่นๆ ในระบบมาก)
export async function createLoginPopupImage(formData, onUploadProgress) {
  const { data } = await axios.post(endpoints.loginPopupImages.list, formData, {
    onUploadProgress: (event) => {
      if (!onUploadProgress || !event.total) return;
      onUploadProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data;
}

export async function updateLoginPopupImage(id, formData, onUploadProgress) {
  const { data } = await axios.patch(endpoints.loginPopupImages.details(id), formData, {
    onUploadProgress: (event) => {
      if (!onUploadProgress || !event.total) return;
      onUploadProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data;
}

export async function deleteLoginPopupImage(id) {
  const { data } = await axios.delete(endpoints.loginPopupImages.details(id));
  return data;
}
