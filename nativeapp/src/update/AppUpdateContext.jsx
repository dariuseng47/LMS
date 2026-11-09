import Constants from 'expo-constants';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { apiClient } from '../api/client';
import buildInfo from './buildInfo.json';

// เช็คว่ามีแอปเวอร์ชันใหม่บน server ไหม — เทียบ "เลข build" (YYYYMMDDHHmm) ที่ฝังในแอปตอน build
// (scripts/build-apk.js เขียนลง ./buildInfo.json) กับเลข build ของไฟล์ apk ล่าสุดบน server
// (GET <server>/download/info — server อ่านจากชื่อไฟล์ ดู server/src/routes/download.routes.js)
//
// เช็คตอนเปิดแอป, ตอนแอปกลับมาหน้าจอ (พับไปแล้วเปิดใหม่) และทุก CHECK_INTERVAL_MS
// เมนู "อัปเดตแอป" (app/(app)/app-update.jsx) และป้ายเตือนที่หน้าแรกอ่านค่าจากที่นี่
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

// /download อยู่ที่ราก server ไม่ได้อยู่ใต้ /api/v1 — ตัด /api/v1 ท้าย baseURL ออก
export const SERVER_ORIGIN = String(apiClient.defaults.baseURL || '').replace(/\/api\/v\d+\/?$/, '');
export const APK_DOWNLOAD_URL = `${SERVER_ORIGIN}/download/latest.apk`;

export const CURRENT_BUILD = buildInfo.build || null;
export const CURRENT_VERSION = Constants.expoConfig?.version || '-';

const AppUpdateContext = createContext({
  latest: null,
  checking: false,
  error: '',
  lastCheckedAt: null,
  updateAvailable: false,
  check: () => {},
});

function isNewer(latestBuild) {
  if (!latestBuild) return false; // ไฟล์บน server ไม่มีเลข build → ไม่รู้ว่าใหม่กว่าไหม ไม่เตือน
  // แอปที่ไม่ได้ build ผ่าน npm run build:apk ไม่มีเลข build ของตัวเอง — ระหว่างพัฒนา (Metro) ไม่ต้องเตือน
  if (!CURRENT_BUILD) return !__DEV__;
  return latestBuild > CURRENT_BUILD; // YYYYMMDDHHmm ความยาวเท่ากัน เทียบแบบ string ได้
}

export function AppUpdateProvider({ children }) {
  const [latest, setLatest] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState(null);

  const check = useCallback(async () => {
    setChecking(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_ORIGIN}/download/info`, { headers: { Accept: 'application/json' } });
      if (res.status === 404) {
        setLatest(null); // ยังไม่มีไฟล์บน server
      } else if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      } else {
        setLatest(await res.json());
      }
      setLastCheckedAt(new Date());
    } catch {
      setError('ตรวจสอบเวอร์ชันไม่สำเร็จ — เช็คการเชื่อมต่ออินเทอร์เน็ต');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [check]);

  const value = useMemo(
    () => ({
      latest,
      checking,
      error,
      lastCheckedAt,
      updateAvailable: isNewer(latest?.build),
      check,
    }),
    [latest, checking, error, lastCheckedAt, check]
  );

  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>;
}

export function useAppUpdate() {
  return useContext(AppUpdateContext);
}

// 202611091453 → "9/11/2569 14:53"
export function formatBuild(build) {
  if (!build || !/^\d{12}$/.test(build)) return null;
  const [y, mo, d, h, mi] = [build.slice(0, 4), build.slice(4, 6), build.slice(6, 8), build.slice(8, 10), build.slice(10, 12)];
  return `${Number(d)}/${Number(mo)}/${Number(y) + 543} ${h}:${mi}`;
}
