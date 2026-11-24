import { apiClient } from './client';
import { endpoints } from './endpoints';

// รอบสแกนลงทะเบียนผ้าจาก handheld: trigger -> report (ลงทะเบียนเข้าฐานข้อมูลทันที ไม่ต้องรออนุมัติ)
// ยัง auth ด้วย user JWT (ไม่ใช่ device token) ดู server/src/controllers/scanSessions.controller.js

export async function triggerScanSession({ fabricLotId, fabricCategoryId, deviceId }) {
  const { data } = await apiClient.post(endpoints.scanSessions.list, {
    fabricLotId,
    fabricCategoryId,
    deviceId,
  });
  return data; // { session }
}

export async function fetchScanSession(id) {
  const { data } = await apiClient.get(endpoints.scanSessions.details(id));
  return data; // { session }
}

export async function reportScanSession(id, { epcCodes }) {
  const { data } = await apiClient.post(endpoints.scanSessions.report(id), { epcCodes });
  return data; // { status: 'CONFIRMED', created, skipped } — server เวอร์ชันเดิมตอบ status 'REPORTED'
}

export async function cancelScanSession(id) {
  await apiClient.post(endpoints.scanSessions.cancel(id));
}
