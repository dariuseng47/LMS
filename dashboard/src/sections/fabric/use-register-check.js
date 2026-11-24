import { useMemo } from 'react';

import { useEpcLookup } from 'src/hooks/use-epc-lookup';

import { checkDuplicateEpcs } from 'src/actions/fabric';

// ----------------------------------------------------------------------

// EPC ที่มีในระบบแล้ว -> { [epc]: { epcCode, categoryName, otherHospital } }
// server เทียบแบบไม่สนตัวพิมพ์เล็ก-ใหญ่ รหัสที่คืนมาจึงอาจคนละตัวพิมพ์กับที่พิมพ์/วางเข้ามา
async function fetchRegistered(codes, hospitalId) {
  const { duplicates } = await checkDuplicateEpcs({ epcCodes: codes, hospitalId });
  const byKey = new Map(duplicates.map((d) => [d.epcCode.toUpperCase(), d]));
  const byEpc = {};
  codes.forEach((code) => {
    const duplicate = byKey.get(code.toUpperCase());
    if (duplicate) byEpc[code] = { ...duplicate, epcCode: code };
  });
  return byEpc;
}

// ตรวจ EPC ก่อนลงทะเบียนแบบ "ลิสต์ก่อน ตรวจทีหลัง" — กลับด้านจากหน้าสแกนอื่น: ไม่พบในระบบ = ผ้าใหม่ ลงทะเบียนได้
//   newEpcs    = แท็กที่ไม่ซ้ำ (รวมตัวที่ยังรอตรวจ/ตรวจไม่สำเร็จ) ใช้แสดงในรายการ
//   duplicates = [{ epcCode, categoryName, otherHospital }] มีในระบบแล้ว ลงทะเบียนไม่ได้
//   ready      = ตรวจครบแล้ว ใช้ล็อกปุ่มยืนยัน
export function useRegisterCheck(epcCodes, hospitalId) {
  const { results, pendingCount, failedCount, checkedCount, ready, retryFailed } = useEpcLookup(
    epcCodes,
    hospitalId,
    fetchRegistered
  );

  const { newEpcs, duplicates } = useMemo(() => {
    const fresh = [];
    const existing = [];
    epcCodes.forEach((code) => {
      const entry = results[code];
      if (entry?.state === 'found') existing.push(entry.item);
      else fresh.push(code);
    });
    return { newEpcs: fresh, duplicates: existing };
  }, [epcCodes, results]);

  return { results, newEpcs, duplicates, pendingCount, failedCount, checkedCount, ready, retryFailed };
}
