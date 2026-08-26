import { apiClient } from './client';
import { endpoints } from './endpoints';

// superadmin-only (server/src/routes/hospitals.routes.js) — รายชื่อโรงพยาบาลทั้งหมด
// ใช้ในหน้า "เลือกโรงพยาบาล" ให้ superadmin เลือก tenant ที่จะจัดการจากมือถือ
export async function fetchHospitals() {
  const { data } = await apiClient.get(endpoints.hospitals.list);
  return data; // { hospitals: [{ id, name, organization_name, ... }] }
}
