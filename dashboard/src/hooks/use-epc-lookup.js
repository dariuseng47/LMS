'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import axios, { endpoints } from 'src/utils/axios';
import { createEpcBatchQueue } from 'src/utils/epc-batch-queue';

// ----------------------------------------------------------------------

// ตรวจแท็กที่สแกนได้กับระบบแบบ "ลิสต์ก่อน ตรวจทีหลัง" — หน้าจอโชว์แท็กทันทีที่อ่านได้ แล้ว hook นี้ทยอยค้น
// ข้อมูลผ้า (ลงทะเบียนไหม / ประเภท / สถานะตอนนี้) เบื้องหลังผ่าน POST /tracking/lookup ทีละก้อน ≤ 200
// ไม่ยิงซ้อน ลองใหม่เองถ้าเน็ตสะดุด (ดู utils/epc-batch-queue.js)
//
// เดิมแต่ละชิปแท็กเรียก useGetFabricItemDetail ของตัวเอง = 1 request ต่อแท็ก (300 แท็ก = 300 request
// ยิงพร้อมกัน) หน้าเลยช้า/โดน rate limit ตอนสแกนรถเข็นผ้าทั้งคัน
//
// results: { [epc]: { state: 'found', item } | { state: 'notFound' } | { state: 'error' } }
//   item = { epcCode, status, categoryName, locationName, ... } ตาม tracking.controller.js#lookupByEpcs
//   ไม่มี key = ยังรอตรวจ
// ready = ตรวจครบทุกแท็กในรายการแล้วและไม่มีตัวที่ตรวจไม่สำเร็จ — ใช้ล็อกปุ่มบันทึกจนกว่าจะพร้อม
//
// รายการว่าง (เคลียร์/บันทึกเสร็จ) = ล้างผลทั้งหมด — สแกนชุดถัดไปค้นสดใหม่ (สถานะเปลี่ยนไปแล้วหลังบันทึก)
export function useEpcLookup(epcCodes, hospitalId) {
  const [results, setResults] = useState({});
  const queueRef = useRef(null);
  const requestedRef = useRef(new Set()); // แท็กที่ส่งเข้าคิว/ได้ผลแล้ว — กันค้นซ้ำ

  useEffect(() => {
    requestedRef.current = new Set();
    setResults({});
    if (!hospitalId) return undefined;

    const queue = createEpcBatchQueue({
      fetchBatch: async (codes) => {
        const { data } = await axios.post(
          endpoints.tracking.lookup,
          { epcCodes: codes },
          { params: { hospitalId } }
        );
        const byEpc = {};
        (data?.items || []).forEach((item) => {
          byEpc[item.epcCode] = item;
        });
        return byEpc;
      },
      onResults: (byEpc) =>
        setResults((prev) => {
          const next = { ...prev };
          Object.entries(byEpc).forEach(([code, item]) => {
            if (!requestedRef.current.has(code)) return; // ถูกลบออกจากรายการไประหว่างรอผล
            next[code] = item ? { state: 'found', item } : { state: 'notFound' };
          });
          return next;
        }),
      onFailed: (codes) =>
        setResults((prev) => {
          const next = { ...prev };
          codes.forEach((code) => {
            if (requestedRef.current.has(code)) next[code] = { state: 'error' };
          });
          return next;
        }),
    });
    queueRef.current = queue;
    return () => {
      queue.dispose();
      queueRef.current = null;
    };
  }, [hospitalId]);

  useEffect(() => {
    const queue = queueRef.current;
    if (!queue) return;

    if (epcCodes.length === 0) {
      if (requestedRef.current.size > 0) {
        queue.clear();
        requestedRef.current = new Set();
        setResults({});
      }
      return;
    }

    const current = new Set(epcCodes);
    // แท็กที่หายจากรายการ (เช่น พิมพ์รหัสเองทีละตัว "E", "EP", ...) — ถอนออกจากคิวก่อนถูกส่งไปค้นฟรี ๆ
    requestedRef.current.forEach((code) => {
      if (!current.has(code)) {
        queue.remove(code);
        requestedRef.current.delete(code);
      }
    });

    const fresh = epcCodes.filter((code) => !requestedRef.current.has(code));
    if (fresh.length === 0) return;
    fresh.forEach((code) => requestedRef.current.add(code));
    queue.push(fresh);
  }, [epcCodes, hospitalId]);

  const summary = useMemo(() => {
    let pending = 0;
    let found = 0;
    let notFound = 0;
    let failed = 0;
    epcCodes.forEach((code) => {
      const entry = results[code];
      if (!entry) pending += 1;
      else if (entry.state === 'found') found += 1;
      else if (entry.state === 'notFound') notFound += 1;
      else failed += 1;
    });
    return {
      pendingCount: pending,
      foundCount: found,
      notFoundCount: notFound,
      failedCount: failed,
      checkedCount: found + notFound,
      ready: pending === 0 && failed === 0,
    };
  }, [epcCodes, results]);

  const retryFailed = useCallback(() => {
    const queue = queueRef.current;
    if (!queue) return;
    const failed = epcCodes.filter((code) => results[code]?.state === 'error');
    if (failed.length === 0) return;
    setResults((prev) => {
      const next = { ...prev };
      failed.forEach((code) => delete next[code]);
      return next;
    });
    queue.push(failed);
  }, [epcCodes, results]);

  return { results, retryFailed, ...summary };
}
