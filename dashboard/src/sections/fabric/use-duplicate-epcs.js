import { useRef, useState, useEffect, useMemo } from 'react';

import { checkDuplicateEpcs } from 'src/actions/fabric';

// ----------------------------------------------------------------------

const DEBOUNCE_MS = 400;
const MAX_PER_REQUEST = 500;

// เช็ค EPC ซ้ำกับในระบบตั้งแต่ขั้นกรอก/สแกน (ไม่ต้องรอกดลงทะเบียนแล้วค่อยรู้ว่าถูกข้าม)
// คืน { duplicates: [{ epcCode, categoryName, otherHospital }], checking } — เช็คเฉพาะรหัสที่ยังไม่เคยเช็ค
export function useDuplicateEpcs(epcCodes, hospitalId) {
  const [known, setKnown] = useState({}); // epc -> { categoryName, otherHospital } | null (ไม่ซ้ำ)
  const [checking, setChecking] = useState(false);
  const checkedRef = useRef(new Set());

  // เปลี่ยนโรงพยาบาล (superadmin) — ผลเดิมใช้ไม่ได้ เพราะชื่อประเภทบอกเฉพาะของโรงพยาบาลที่เลือก
  useEffect(() => {
    checkedRef.current = new Set();
    setKnown({});
  }, [hospitalId]);

  const codesKey = epcCodes.join('\n');

  useEffect(() => {
    const pending = epcCodes.filter((code) => !checkedRef.current.has(code));
    if (pending.length === 0) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        for (let i = 0; i < pending.length; i += MAX_PER_REQUEST) {
          const batch = pending.slice(i, i + MAX_PER_REQUEST);
          // eslint-disable-next-line no-await-in-loop
          const { duplicates } = await checkDuplicateEpcs({ epcCodes: batch, hospitalId });
          if (cancelled) return;
          const result = Object.fromEntries(batch.map((code) => [code, null]));
          duplicates.forEach((d) => {
            result[d.epcCode] = { categoryName: d.categoryName, otherHospital: d.otherHospital };
          });
          batch.forEach((code) => checkedRef.current.add(code));
          setKnown((prev) => ({ ...prev, ...result }));
        }
      } catch {
        // เช็คไม่สำเร็จ — ปล่อยผ่าน server จะข้าม EPC ซ้ำตอนลงทะเบียนอยู่แล้ว
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codesKey, hospitalId]);

  const duplicates = useMemo(
    () => epcCodes.filter((code) => known[code]).map((code) => ({ epcCode: code, ...known[code] })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codesKey, known]
  );

  return { duplicates, checking };
}
