import { useRef, useState, useEffect, useCallback } from 'react';

import { scanCheckpoint } from 'src/actions/rfidReader';

import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------

// อ่าน RFID แบบต่อเนื่อง: ยิง scanCheckpoint ซ้ำติดกันจนกว่าจะกดหยุด แต่ละรอบที่เจอ EPC จะส่งเข้า
// onTags ทันที (ให้ผู้เรียกเอาไปรวมกับรายการที่มีอยู่) — ความเร็วต่อรอบคุมจาก scan_profile ของ
// อุปกรณ์ฝั่ง backend (ตั้ง "เร็วมาก" ได้ในหน้า "อุปกรณ์ & สัญญาณ RFID")
// maxErrors = error ติดกันกี่รอบถึงหยุด (ค่าเริ่มต้น 1 = หยุดทันทีเหมือนเดิม) — หน้าที่เปิดอ่านนานๆ
// ตั้งมากขึ้นได้ ให้ทนเน็ตสะดุดชั่วคราว (เช่น server บนคลาวด์ ↔ reader agent) โดยรอ 1 วิแล้วลองใหม่
export function useAutoScan({ hospitalId, onTags, gapMs = 100, maxErrors = 1 }) {
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  // เลขรอบการกดเริ่ม — กดหยุดแล้วเริ่มใหม่ทันทีขณะ request เก่ายังค้าง ลูปเก่าต้องจบตัวเองและทิ้งผลที่ค้าง
  // (ไม่งั้นลูปซ้อน 2 ตัว + แท็กของชุดก่อนหลุดเข้ารายการชุดใหม่)
  const runIdRef = useRef(0);
  const deviceRef = useRef(null);
  const onTagsRef = useRef(onTags);

  useEffect(() => {
    onTagsRef.current = onTags;
  });

  const loop = useCallback(async () => {
    runIdRef.current += 1;
    const runId = runIdRef.current;
    const isActive = () => runningRef.current && runIdRef.current === runId;
    let errorStreak = 0;
    while (isActive()) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const { epcs } = await scanCheckpoint(Number(deviceRef.current), hospitalId);
        errorStreak = 0;
        if (isActive() && epcs.length) onTagsRef.current(epcs);
      } catch (error) {
        if (!isActive()) return; // หยุดไปแล้ว — error ของรอบที่ค้างไม่ต้องเตือน
        errorStreak += 1;
        if (errorStreak >= maxErrors) {
          runningRef.current = false;
          setRunning(false);
          toast.error(error?.message || 'อ่านอัตโนมัติหยุด — เชื่อมต่อเครื่องอ่านไม่สำเร็จ');
          return;
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => {
          setTimeout(r, 1000);
        });
      }
      if (gapMs > 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => {
          setTimeout(r, gapMs);
        });
      }
    }
  }, [hospitalId, gapMs, maxErrors]);

  const start = useCallback(
    (deviceId) => {
      if (runningRef.current || !deviceId) return;
      deviceRef.current = deviceId;
      runningRef.current = true;
      setRunning(true);
      loop();
    },
    [loop]
  );

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
  }, []);

  // หยุดวนอ่านเมื่อ component ถูก unmount
  useEffect(
    () => () => {
      runningRef.current = false;
    },
    []
  );

  return { running, start, stop };
}
