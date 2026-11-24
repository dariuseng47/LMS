import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ===== Groups (หมวดหมู่ผ้า เช่น ผ้าเสตอไลส์ / ผ้าสามัญ) =====

export function useGetFabricGroups(hospitalId) {
  const url = hospitalId ? [endpoints.fabricGroups.list, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      groups: data?.groups || [],
      groupsLoading: isLoading,
      groupsError: error,
      refreshGroups: mutate,
    }),
    [data?.groups, error, isLoading, mutate]
  );
}

export async function createFabricGroup(payload) {
  const { data } = await axios.post(endpoints.fabricGroups.list, payload);
  return data;
}

export async function updateFabricGroup(id, payload) {
  await axios.patch(endpoints.fabricGroups.details(id), payload);
}

export async function deleteFabricGroup(id) {
  await axios.delete(endpoints.fabricGroups.details(id));
}

// ===== Categories (ประเภทผ้า เช่น ชุดผ่าตัด / ผ้าปูเตียง — สังกัดหมวดหมู่ผ้า) =====

export function useGetFabricCategories(hospitalId) {
  const url = hospitalId ? [endpoints.fabricCategories.list, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      categories: data?.categories || [],
      categoriesLoading: isLoading,
      categoriesError: error,
      refreshCategories: mutate,
    }),
    [data?.categories, error, isLoading, mutate]
  );
}

export async function createFabricCategory(payload) {
  const { data } = await axios.post(endpoints.fabricCategories.list, payload);
  return data;
}

export async function updateFabricCategory(id, payload) {
  await axios.patch(endpoints.fabricCategories.details(id), payload);
}

export async function deleteFabricCategory(id) {
  await axios.delete(endpoints.fabricCategories.details(id));
}

// ป้ายชื่อประเภทผ้าสำหรับ dropdown — แสดงหมวดหมู่นำหน้าให้รู้ว่าสังกัดหมวดไหน
export function fabricCategoryLabel(category) {
  return category.group_name ? `${category.group_name} › ${category.name}` : category.name;
}

// ===== Lots =====

export function useGetFabricLots(hospitalId) {
  const url = hospitalId ? [endpoints.fabricLots.list, { params: { hospitalId } }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      lots: data?.lots || [],
      lotsLoading: isLoading,
      lotsError: error,
      refreshLots: mutate,
    }),
    [data?.lots, error, isLoading, mutate]
  );
}

export async function createFabricLot(payload) {
  const { data } = await axios.post(endpoints.fabricLots.list, payload);
  return data;
}

// ===== Items =====

export function useGetFabricItems(filters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')
  );
  const url = [endpoints.fabricItems.list, { params }];

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      fabricItems: data?.fabricItems || [],
      fabricItemsLoading: isLoading,
      fabricItemsError: error,
      fabricItemsEmpty: !isLoading && !data?.fabricItems?.length,
      refreshFabricItems: mutate,
    }),
    [data?.fabricItems, error, isLoading, mutate]
  );
}

function cleanParams(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

// โหลดทีละหน้าจาก server (GET /fabric-items?limit=&offset=) — ใช้กับตารางที่ผ้าอาจมีหลายหมื่นชิ้น
// (คลังผ้าทั้งหมด / ประวัติจำหน่ายออก) filters รับ status, categoryId, search, createdFrom/To,
// updatedFrom/To (YYYY-MM-DD), orderBy เหมือน endpoint
// keepPreviousData: กดเปลี่ยนหน้าแล้วตารางเดิมค้างไว้จนหน้าใหม่มา ไม่กระพริบเป็นหน้าโหลด
export function useGetFabricItemsPage(filters = {}, { page = 0, rowsPerPage = 25 } = {}) {
  const params = cleanParams({ ...filters, limit: rowsPerPage, offset: page * rowsPerPage });
  const url = filters.hospitalId ? [endpoints.fabricItems.list, { params }] : null;

  const { data, isLoading, isValidating, error, mutate } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  return useMemo(
    () => ({
      fabricItems: data?.fabricItems || [],
      fabricItemsTotal: data?.total || 0,
      fabricItemsLoading: isLoading,
      fabricItemsValidating: isValidating,
      fabricItemsError: error,
      refreshFabricItems: mutate,
    }),
    [data?.fabricItems, data?.total, error, isLoading, isValidating, mutate]
  );
}

// ดึงทุกแถวตามตัวกรอง (ไม่แบ่งหน้า) — ใช้ตอนกด Export เท่านั้น ไม่ผูก SWR
export async function fetchAllFabricItems(filters = {}) {
  const { data } = await axios.get(endpoints.fabricItems.list, { params: cleanParams(filters) });
  return data?.fabricItems || [];
}

export function useGetFabricItemDetail(epcCode, hospitalId) {
  const url = epcCode
    ? [endpoints.fabricItems.details(epcCode), { params: hospitalId ? { hospitalId } : {} }]
    : '';

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      fabricItem: data?.fabricItem,
      scanHistory: data?.scanHistory || [],
      detailLoading: isLoading,
      detailError: error,
      refreshDetail: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

// ลงทะเบียนหลายชิ้นพร้อมกัน (เช่น รับผ้าล็อตใหม่ทีละหลัก 100 ชิ้น) ไม่เกิน 500 ชิ้นต่อครั้ง — คืน { created, skipped }
// deviceId = เครื่องอ่าน RFID ที่อ่านชุดนี้ (ไม่ส่ง = พิมพ์/วางรหัสเอง) ใช้แสดงในประวัติการลงทะเบียน
export async function bulkCreateFabricItems(payload) {
  const { data } = await axios.post(endpoints.fabricItems.bulk, payload);
  return data;
}

// เช็คว่า EPC ไหนมีในระบบแล้วบ้าง — คืน { duplicates: [{ epcCode, categoryName, otherHospital }] }
export async function checkDuplicateEpcs(payload) {
  const { data } = await axios.post(endpoints.fabricItems.checkEpcs, payload);
  return data;
}

export async function holdFabricItem(id, payload) {
  const { data } = await axios.post(endpoints.fabricItems.hold(id), payload);
  return data;
}

export async function decommissionFabricItem(id, payload) {
  const { data } = await axios.post(endpoints.fabricItems.decommission(id), payload);
  return data;
}

// เปลี่ยนสถานะผ้าด้วยมือจาก popup หน้าคลังผ้า — ใช้ endpoint เดียวกับเมนู "เปลี่ยนสถานะผ้า" บนมือถือ
// ส่งทีละชิ้น (epcCodes: [epcCode]) confirm=true เปลี่ยนเลย ต้องมีสิทธิ์ fabric.item.status_change
// hospitalId ต้องส่งเสมอ — superadmin ไม่มี hospital_id ใน JWT (server ตีกลับ 400 ถ้าไม่ระบุ)
export async function changeFabricItemStatus({ epcCode, fromStatus, toStatus }, hospitalId) {
  const { data } = await axios.post(
    endpoints.scans.statusChange,
    {
      epcCodes: [epcCode],
      fromStatus,
      toStatus,
      confirm: true,
    },
    { params: hospitalId ? { hospitalId } : {} }
  );
  return data;
}

// ===== ประวัติการลงทะเบียนผ้า (1 รอบ = กดยืนยัน 1 ครั้ง) =====

// filters: from, to (YYYY-MM-DD), categoryId, deviceId, source
const EMPTY_REGISTRATION_SUMMARY = {
  batchCount: 0,
  itemCount: 0,
  skippedCount: 0,
  byCategory: [],
  byDevice: [],
};

export function useGetRegistrations(hospitalId, filters = {}, { page = 0, rowsPerPage = 25 } = {}) {
  const params = cleanParams({
    ...filters,
    hospitalId,
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  });
  const url = hospitalId ? [endpoints.fabricItems.registrations, { params }] : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  return useMemo(
    () => ({
      registrations: data?.batches || [],
      registrationsTotal: data?.total || 0,
      registrationsSummary: data?.summary || EMPTY_REGISTRATION_SUMMARY,
      registrationsLoading: isLoading,
      registrationsError: error,
      refreshRegistrations: mutate,
    }),
    [data, error, isLoading, mutate]
  );
}

const REGISTRATION_EXPORT_CHUNK = 500; // = limit สูงสุดของ endpoint

// ดึงทุกรอบตามตัวกรอง (ไม่แบ่งหน้า) — ใช้ตอนกด Export เท่านั้น
export async function fetchAllRegistrations(hospitalId, filters = {}) {
  const all = [];
  let total = Infinity;
  while (all.length < total) {
    // eslint-disable-next-line no-await-in-loop
    const { data } = await axios.get(endpoints.fabricItems.registrations, {
      params: cleanParams({
        ...filters,
        hospitalId,
        limit: REGISTRATION_EXPORT_CHUNK,
        offset: all.length,
      }),
    });
    if (!data.batches.length) break;
    all.push(...data.batches);
    ({ total } = data);
  }
  return all;
}

// รายชิ้นของรอบเดียว (โหลดตอนกางแถว) — มีสถานะ "ตอนนี้" ของแต่ละชิ้น จึงดึงใหม่ทุกครั้งที่กาง
export function useGetRegistrationDetail(id, hospitalId) {
  const url = [endpoints.fabricItems.registrationDetails(id), { params: { hospitalId } }];

  const { data, isLoading, error } = useSWR(url, fetcher, {
    ...swrOptions,
    revalidateOnMount: true,
  });

  return useMemo(
    () => ({
      registrationItems: data?.items || [],
      registrationItemsLoading: isLoading,
      registrationItemsError: error,
    }),
    [data?.items, error, isLoading]
  );
}

// ===== เปลี่ยนหมวดหมู่ / ประเภทผ้า (+ ประวัติ version / ย้อนกลับ) =====

// confirm=false -> preview { ready, same, blocked, notFound, toCategory }, confirm=true -> เปลี่ยนจริง { batchId, applied, ... }
export async function changeFabricCategory(payload, hospitalId) {
  const { data } = await axios.post(endpoints.fabricItems.changeCategory, payload, {
    params: hospitalId ? { hospitalId } : {},
  });
  return data;
}

export function useGetCategoryChanges(hospitalId, { limit = 10, offset = 0 } = {}) {
  const url = hospitalId
    ? [endpoints.fabricItems.categoryChanges, { params: { hospitalId, limit, offset } }]
    : null;

  const { data, isLoading, error, mutate } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({
      changeBatches: data?.batches || [],
      changeBatchesTotal: data?.total || 0,
      changeBatchesLoading: isLoading,
      changeBatchesError: error,
      refreshChangeBatches: mutate,
    }),
    [data?.batches, data?.total, error, isLoading, mutate]
  );
}

export async function getCategoryChangeDetail(id, hospitalId) {
  const { data } = await axios.get(endpoints.fabricItems.categoryChangeDetails(id), {
    params: hospitalId ? { hospitalId } : {},
  });
  return data; // { batch, items }
}

// ย้อนกลับทั้ง batch — confirm=false -> preview { revertible, conflicts }, confirm=true -> ย้อนจริง
export async function revertCategoryChange(id, payload, hospitalId) {
  const { data } = await axios.post(endpoints.fabricItems.categoryChangeRevert(id), payload, {
    params: hospitalId ? { hospitalId } : {},
  });
  return data;
}
