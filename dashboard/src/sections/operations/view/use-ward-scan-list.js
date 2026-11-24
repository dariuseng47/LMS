import { useRef, useMemo, useState, useCallback } from 'react';

import { useEpcLookup } from 'src/hooks/use-epc-lookup';

// ----------------------------------------------------------------------

// กติกาเดียวกับ server/src/controllers/wardScan.controller.js — หน้าจอแยกกลุ่มให้เห็นก่อนกดยืนยัน
// (server ตรวจซ้ำอีกรอบตอนบันทึกเสมอ)
const ISSUE_BLOCKED_STATUSES = ['HOLD', 'DECOMMISSIONED', 'PENDING_DECOMMISSION', 'REWASH'];
const RECEIVE_SOURCE_STATUSES = ['WARD_CABINET', 'IN_USE_WARD'];

// ชนิดของแท็ก 1 ชิ้นในรายการ
//   บันทึกได้: ok | transfer (จ่ายเข้าตู้ — ย้ายมาจากตู้อื่น)
//   ข้าม:     here (อยู่ตู้นี้แล้ว) | blocked (จ่ายไม่ได้) | notAtWard (รับคืนไม่ได้)
//   อื่น ๆ:    pending (รอตรวจกับระบบ) | error (ตรวจไม่สำเร็จ) | notFound (ไม่พบในระบบ — ไม่อยู่ในรายการ)
export const VALID_KINDS = ['ok', 'transfer'];

export const SKIP_KIND_META = {
  here: {
    title: 'อยู่ในตู้นี้แล้ว',
    caption: 'สแกนติดผ้าที่อยู่ในตู้ปลายทางอยู่แล้ว — ไม่บันทึกซ้ำ',
    icon: 'solar:box-bold-duotone',
    color: 'default',
  },
  blocked: {
    title: 'จ่ายไม่ได้',
    caption: 'พักใช้งาน / แทงชำรุด / รอส่งซักใหม่',
    icon: 'solar:forbidden-circle-bold-duotone',
    color: 'error',
  },
  notAtWard: {
    title: 'ไม่ได้อยู่ที่วอร์ด',
    caption: 'รับคืนได้เฉพาะผ้าที่อยู่ตู้แผนก / ใช้งานที่วอร์ด',
    icon: 'solar:forbidden-circle-bold-duotone',
    color: 'error',
  },
};
const SKIP_ORDER = Object.keys(SKIP_KIND_META);

export function wardTagKind(entry, mode, cabinetId) {
  if (!entry) return 'pending';
  if (entry.state === 'error') return 'error';
  if (entry.state !== 'found') return 'notFound';

  const { status, currentLocationType, currentLocationId } = entry.item;
  if (mode === 'receive') return RECEIVE_SOURCE_STATUSES.includes(status) ? 'ok' : 'notAtWard';

  if (ISSUE_BLOCKED_STATUSES.includes(status)) return 'blocked';
  if (currentLocationType !== 'CABINET' || currentLocationId == null) return 'ok';
  // ยังไม่เลือกตู้ = ยังบอกไม่ได้ว่าตู้เดียวกันหรือไม่ แสดงเป็นย้ายจากตู้ไว้ก่อน
  if (!cabinetId) return 'transfer';
  if (Number(currentLocationId) !== Number(cabinetId)) return 'transfer';
  return status === 'WARD_CABINET' ? 'here' : 'ok';
}

const categoryKey = (item) => Number(item.fabricCategoryId) || 0;

/**
 * รายการแท็กของหน้า "สแกนรับ-ส่งผ้า" — สะสมจากเครื่องอ่าน / กรอกรหัสเอง ตรวจกับระบบเป็นก้อนเบื้องหลัง
 * (useEpcLookup) แล้วจัดกลุ่มตามประเภทผ้า ไม่แสดงรายชิ้น (ดูรายแท็กผ่าน dialog)
 *
 * categoryGroups = ผ้าที่บันทึกได้ แยกตามประเภท เรียงตามลำดับที่สแกนเจอ (ไม่สลับที่ระหว่างอ่านต่อเนื่อง)
 * skipGroups = ผ้าที่ถูกข้าม แยกตามเหตุผล | validEpcs = รหัสที่จะส่งไปบันทึก
 */
export function useWardScanList({ hospitalId, mode, cabinetId }) {
  // ลำดับที่สแกนเจอ (เก่า -> ใหม่) — seenRef กันซ้ำแบบ sync (แท็กไหลเข้าเร็วกว่า state อัปเดต)
  const [tagEpcs, setTagEpcs] = useState([]);
  const seenRef = useRef(new Set());
  const [lastAdded, setLastAdded] = useState([]);

  // codes = รหัส (string) หรือผลจากเครื่องอ่าน ({ epc, rssi }) — คืนจำนวนที่เพิ่มใหม่จริง
  const addTags = useCallback((codes) => {
    const fresh = [];
    codes.forEach((raw) => {
      const code = typeof raw === 'string' ? raw.trim() : raw?.epc?.trim();
      if (!code || seenRef.current.has(code)) return;
      seenRef.current.add(code);
      fresh.push(code);
    });
    if (fresh.length) {
      setTagEpcs((prev) => [...prev, ...fresh]);
      setLastAdded(fresh);
    }
    return fresh.length;
  }, []);

  const removeTag = useCallback((code) => {
    seenRef.current.delete(code);
    setTagEpcs((prev) => prev.filter((c) => c !== code));
  }, []);

  const clear = useCallback(() => {
    seenRef.current = new Set();
    setTagEpcs([]);
    setLastAdded([]);
  }, []);

  const lookup = useEpcLookup(tagEpcs, hospitalId);
  const { results, listedEpcs } = lookup;

  const grouped = useMemo(() => {
    const kinds = {};
    const categories = new Map();
    const skips = new Map();
    const pendingEpcs = [];
    const errorEpcs = [];
    const validEpcs = [];

    listedEpcs.forEach((epc) => {
      const entry = results[epc];
      const kind = wardTagKind(entry, mode, cabinetId);
      kinds[epc] = kind;
      if (kind === 'pending') pendingEpcs.push(epc);
      else if (kind === 'error') errorEpcs.push(epc);
      else if (VALID_KINDS.includes(kind)) {
        validEpcs.push(epc);
        const key = categoryKey(entry.item);
        if (!categories.has(key)) {
          categories.set(key, {
            categoryId: key,
            name: entry.item.categoryName || 'ไม่ระบุประเภทผ้า',
            epcs: [],
            transferCount: 0,
          });
        }
        const group = categories.get(key);
        group.epcs.push(epc);
        if (kind === 'transfer') group.transferCount += 1;
      } else if (SKIP_KIND_META[kind]) {
        if (!skips.has(kind)) skips.set(kind, { kind, ...SKIP_KIND_META[kind], epcs: [] });
        skips.get(kind).epcs.push(epc);
      }
    });

    return {
      kinds,
      pendingEpcs,
      errorEpcs,
      validEpcs,
      categoryGroups: [...categories.values()],
      skipGroups: [...skips.values()].sort(
        (a, b) => SKIP_ORDER.indexOf(a.kind) - SKIP_ORDER.indexOf(b.kind)
      ),
      transferCount: [...categories.values()].reduce((sum, g) => sum + g.transferCount, 0),
      skippedCount: [...skips.values()].reduce((sum, g) => sum + g.epcs.length, 0),
    };
  }, [listedEpcs, results, mode, cabinetId]);

  const lastAddedCount = useMemo(
    () => lastAdded.filter((code) => results[code]?.state !== 'notFound').length,
    [lastAdded, results]
  );

  return { tagEpcs, lookup, addTags, removeTag, clear, lastAddedCount, ...grouped };
}

// ----------------------------------------------------------------------

/**
 * เทียบผ้าที่สแกนได้กับแผน "จัดผ้าเข้ารถ" ของตู้ปลายทาง (lines จาก GET /restock-cart-plan)
 * targets = ประเภทที่ตู้ต้องเติม (เรียงตามแผน) | extras = ประเภทที่สแกนมาแต่ไม่อยู่ในแผน
 */
export function buildPlanProgress(lines = [], categoryGroups = []) {
  const groupById = new Map(categoryGroups.map((g) => [g.categoryId, g]));
  const lineById = new Map(lines.map((line) => [Number(line.fabricCategoryId), line]));

  const targets = lines
    .filter((line) => line.suggestedLoadQty > 0)
    .map((line) => {
      const id = Number(line.fabricCategoryId);
      const epcs = groupById.get(id)?.epcs ?? [];
      return {
        categoryId: id,
        name: line.categoryName,
        target: line.suggestedLoadQty,
        scanned: epcs.length,
        epcs,
        done: epcs.length >= line.suggestedLoadQty,
      };
    });

  const targetIds = new Set(targets.map((t) => t.categoryId));
  const extras = categoryGroups
    .filter((g) => !targetIds.has(g.categoryId))
    .map((g) => ({
      categoryId: g.categoryId,
      name: g.name,
      scanned: g.epcs.length,
      epcs: g.epcs,
      reason: lineById.has(g.categoryId) ? 'full' : 'noPar',
    }));

  const plannedQty = targets.reduce((sum, t) => sum + t.target, 0);
  const coveredQty = targets.reduce((sum, t) => sum + Math.min(t.scanned, t.target), 0);

  return {
    targets,
    extras,
    doneCount: targets.filter((t) => t.done).length,
    plannedQty,
    coveredQty,
    percent: plannedQty ? Math.round((coveredQty / plannedQty) * 100) : 0,
  };
}
