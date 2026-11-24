import { pool } from '../db/pool.js';
import { resolveTenantId } from '../utils/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

import { fetchWardDirectory, resolveScopeWards } from './restockFillHistory.controller.js';

// แท็บ "ประวัติผ้าส่งซักใหม่" (หน้า ประวัติ & วิเคราะห์การเติมผ้า) — วิเคราะห์จาก rewash_records
// (1 แถว = ผ้า 1 ชิ้นถูกส่งซักใหม่ 1 ครั้ง, snapshot สถานะเดิม/ตู้/แผนก ณ ตอนส่ง — ดู migration 038)
// ตอบคำถามหลัก: ผ้าส่งซักใหม่มาจากแผนกไหน / มาจากสถานะไหนมากที่สุด + ประเภทผ้า, เหตุผล, ชิ้นที่ส่งซ้ำบ่อย,
// ยังรอซักอยู่กี่ชิ้น, ส่งแล้วใช้เวลานานแค่ไหนกว่าจะได้ซัก
//
// ตัวกรองตึก/วอร์ด: ถ้าเลือก จะเหลือเฉพาะ record ที่มาจากตู้ของวอร์ดในขอบเขตนั้น (ผ้าที่ส่งจากสต๊อกกลาง/
// ฝ่ายซักไม่มีแผนก จะไม่ถูกนับ) — ไม่เลือก = ทุก record รวมที่ไม่ได้มาจากวอร์ด

const RECENT_LIMIT = 500; // รายการล่าสุดที่ส่งกลับไปแสดงในตาราง (สรุปยังนับครบทุกแถว)
const REPEAT_LIMIT = 30;
const MAX_DAILY_DAYS = 120; // ช่วงยาวกว่านี้ไม่ส่งกราฟรายวัน (แท่งเยอะจนอ่านไม่ออก) — ส่งรายสัปดาห์แทน

const NO_WARD_KEY = 'none';

function buildDateRange(startDate, endDate) {
  const fmt = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  const fromDay = startDate || fmt(monthAgo);
  const toDay = endDate || fmt(today);
  return { fromDay, toDay, from: `${fromDay} 00:00:00`, to: `${toDay} 23:59:59` };
}

function toDate(value) {
  return value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
}

function eachDay(fromDay, toDay) {
  const days = [];
  const cur = new Date(`${fromDay}T00:00:00Z`);
  const end = new Date(`${toDay}T00:00:00Z`);
  while (cur <= end && days.length < 3700) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

const pct = (n, total) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
const round1 = (n) => Math.round(n * 10) / 10;

function countBy(list, keyFn) {
  const map = new Map();
  list.forEach((item) => {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function topEntry(map) {
  let best = null;
  map.forEach((count, key) => {
    if (!best || count > best.count) best = { key, count };
  });
  return best;
}

/**
 * GET /api/v1/restock-report/rewash-analysis — ทุก role ที่ดูรายงานการเติมผ้าได้ (อ่านอย่างเดียว)
 * ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (ไม่ส่ง = 30 วันล่าสุด) &buildingId=&wardIds=1,2
 */
export const getRewashAnalysis = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { fromDay, toDay, from, to } = buildDateRange(req.query.startDate, req.query.endDate);
  const { buildingId, wardIds } = req.query;
  const scoped = Boolean(buildingId) || (wardIds && wardIds.length > 0);

  const wardDirectory = await fetchWardDirectory(tenantId);
  const wardById = new Map(wardDirectory.map((w) => [w.wardId, w]));
  const scopeWardIds = scoped
    ? new Set(resolveScopeWards(wardDirectory, buildingId, wardIds).map((w) => w.wardId))
    : null;

  const [rows] = await pool.query(
    `SELECT rr.id, rr.fabric_item_id, rr.fabric_category_id, rr.prev_status, rr.prev_location_type,
            rr.cabinet_id, rr.department_id, rr.reason_code, rr.created_at, rr.closed_at, rr.close_type,
            fi.epc_code, fi.status AS current_status, fc.name AS category_name,
            c.name AS cabinet_name, u.full_name AS user_name
     FROM rewash_records rr
     JOIN fabric_items fi ON fi.id = rr.fabric_item_id
     LEFT JOIN fabric_categories fc ON fc.id = rr.fabric_category_id
     LEFT JOIN cabinets c ON c.id = rr.cabinet_id
     LEFT JOIN users u ON u.id = rr.user_id
     WHERE rr.hospital_id = ? AND rr.created_at BETWEEN ? AND ?
     ORDER BY rr.created_at DESC, rr.id DESC`,
    [tenantId, from, to]
  );

  const records = scopeWardIds ? rows.filter((r) => scopeWardIds.has(r.department_id)) : rows;
  return res.json({ range: { from, to }, ...buildRewashAnalysis({ records, wardById, fromDay, toDay }) });
});

/**
 * สรุปสถิติจากแถว rewash_records (join แล้ว เรียงใหม่→เก่า) — pure function แยกไว้ทดสอบได้โดยไม่ต้องมี DB
 * @param records  [{ id, fabric_item_id, fabric_category_id, prev_status, department_id, reason_code,
 *                   created_at, closed_at, close_type, epc_code, current_status, category_name,
 *                   cabinet_name, user_name }]
 * @param wardById Map<wardId, { wardName, buildingName }>
 */
export function buildRewashAnalysis({ records, wardById, fromDay, toDay }) {
  const total = records.length;

  // ---- สรุปภาพรวม ----
  const recordsByItem = new Map(); // fabric_item_id -> record[] (เรียงใหม่→เก่า ตาม ORDER BY)
  records.forEach((r) => {
    if (!recordsByItem.has(r.fabric_item_id)) recordsByItem.set(r.fabric_item_id, []);
    recordsByItem.get(r.fabric_item_id).push(r);
  });
  const repeatItemCount = [...recordsByItem.values()].filter((list) => list.length >= 2).length;
  // "ยังรอซัก" = record ยังไม่ปิด และผ้ายังเป็น REWASH อยู่จริง (กันกรณีผ้าถูกพัก/แทงชำรุดไประหว่างรอ)
  const openCount = records.filter((r) => !r.closed_at && r.current_status === 'REWASH').length;
  const washed = records.filter((r) => r.close_type === 'WASHED' && r.closed_at);
  const bypassedCount = records.filter((r) => r.close_type === 'BYPASSED').length;
  const turnaroundHours = washed.map(
    (r) => (toDate(r.closed_at).getTime() - toDate(r.created_at).getTime()) / 3600000
  );
  const avgTurnaroundHours =
    turnaroundHours.length > 0
      ? round1(turnaroundHours.reduce((s, h) => s + h, 0) / turnaroundHours.length)
      : null;
  const fromWardCount = records.filter((r) => r.department_id != null).length;

  // ---- แยกตามสถานะต้นทาง ----
  const statusMap = countBy(records, (r) => r.prev_status);
  const byStatus = [...statusMap.entries()]
    .map(([status, count]) => ({ status, count, pct: pct(count, total) }))
    .sort((a, b) => b.count - a.count);

  // ---- แยกตามแผนก/วอร์ด (ผ้าที่ไม่ได้อยู่ตู้แผนกตอนส่ง = กลุ่ม "ไม่ได้มาจากวอร์ด") ----
  const wardGroups = new Map();
  records.forEach((r) => {
    const key = r.department_id != null ? String(r.department_id) : NO_WARD_KEY;
    if (!wardGroups.has(key)) wardGroups.set(key, []);
    wardGroups.get(key).push(r);
  });
  const byWard = [...wardGroups.entries()]
    .map(([key, list]) => {
      const ward = key === NO_WARD_KEY ? null : wardById.get(Number(key));
      const categoryTop = topEntry(countBy(list, (r) => r.category_name || 'ไม่ระบุประเภท'));
      const statusCounts = Object.fromEntries(countBy(list, (r) => r.prev_status));
      return {
        wardId: key === NO_WARD_KEY ? null : Number(key),
        wardName:
          key === NO_WARD_KEY ? 'ไม่ได้มาจากวอร์ด (สต๊อกกลาง/จ่ายกลาง/ฝ่ายซัก)' : ward?.wardName ?? 'วอร์ดที่ถูกลบ',
        buildingName: key === NO_WARD_KEY ? '-' : ward?.buildingName ?? '-',
        count: list.length,
        pct: pct(list.length, total),
        uniqueItems: new Set(list.map((r) => r.fabric_item_id)).size,
        byStatus: statusCounts,
        topCategory: categoryTop ? { name: categoryTop.key, count: categoryTop.count } : null,
      };
    })
    // วอร์ดจริงเรียงมาก→น้อย กลุ่ม "ไม่ได้มาจากวอร์ด" ไว้ท้ายเสมอ (ไม่ใช่คำตอบของ "แผนกไหนมากสุด")
    .sort((a, b) => (a.wardId == null) - (b.wardId == null) || b.count - a.count);

  // ---- แยกตามประเภทผ้า / เหตุผล ----
  const categoryMap = new Map();
  records.forEach((r) => {
    const key = r.fabric_category_id;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, { categoryId: key, name: r.category_name || 'ไม่ระบุประเภท', count: 0 });
    }
    categoryMap.get(key).count += 1;
  });
  const byCategory = [...categoryMap.values()]
    .map((c) => ({ ...c, pct: pct(c.count, total) }))
    .sort((a, b) => b.count - a.count);

  const reasonMap = countBy(records, (r) => r.reason_code || null);
  const byReason = [...reasonMap.entries()]
    .map(([reasonCode, count]) => ({ reasonCode, count, pct: pct(count, total) }))
    .sort((a, b) => b.count - a.count);

  // ---- แนวโน้มรายวัน (stack ตามสถานะต้นทาง) — ช่วงยาวมากรวมเป็นรายสัปดาห์ ----
  const allDays = eachDay(fromDay, toDay);
  const weekly = allDays.length > MAX_DAILY_DAYS;
  const bucketOf = (day) => {
    if (!weekly) return day;
    const idx = Math.floor(allDays.indexOf(day) / 7);
    return allDays[idx * 7];
  };
  const buckets = weekly ? allDays.filter((_, i) => i % 7 === 0) : allDays;
  const bucketIndex = new Map(buckets.map((d, i) => [d, i]));
  const seriesStatuses = byStatus.map((s) => s.status);
  const seriesData = new Map(seriesStatuses.map((s) => [s, new Array(buckets.length).fill(0)]));
  records.forEach((r) => {
    const day = String(r.created_at).slice(0, 10);
    const idx = bucketIndex.get(bucketOf(day));
    if (idx == null) return;
    seriesData.get(r.prev_status)[idx] += 1;
  });
  const trend = {
    granularity: weekly ? 'week' : 'day',
    days: buckets,
    series: seriesStatuses.map((status) => ({ status, data: seriesData.get(status) })),
  };

  // ---- ผ้าที่ถูกส่งซักใหม่ซ้ำบ่อย (≥ 2 ครั้งในช่วงนี้) — ตัวเลือกพิจารณาพัก/แทงชำรุด ----
  const repeatItems = [...recordsByItem.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([itemId, list]) => {
      const count = list.length;
      const latest = list[0];
      const wardNames = [
        ...new Set(
          list.map((r) =>
            r.department_id != null ? wardById.get(r.department_id)?.wardName ?? '-' : 'สต๊อกกลาง/จ่ายกลาง/ฝ่ายซัก'
          )
        ),
      ];
      return {
        fabricItemId: itemId,
        epcCode: latest.epc_code,
        categoryName: latest.category_name,
        currentStatus: latest.current_status,
        count,
        lastAt: latest.created_at,
        wardNames,
      };
    })
    .sort((a, b) => b.count - a.count || String(b.lastAt).localeCompare(String(a.lastAt)))
    .slice(0, REPEAT_LIMIT);

  // ---- รายการล่าสุด ----
  const recent = records.slice(0, RECENT_LIMIT).map((r) => {
    const ward = r.department_id != null ? wardById.get(r.department_id) : null;
    return {
      id: r.id,
      createdAt: r.created_at,
      epcCode: r.epc_code,
      categoryName: r.category_name,
      prevStatus: r.prev_status,
      wardName: ward?.wardName ?? null,
      buildingName: ward?.buildingName ?? null,
      cabinetName: r.cabinet_name,
      reasonCode: r.reason_code,
      userName: r.user_name,
      closedAt: r.closed_at,
      closeType: r.close_type,
      currentStatus: r.current_status,
    };
  });

  const topWard = byWard.find((w) => w.wardId != null) ?? null;

  return {
    summary: {
      total,
      uniqueItems: recordsByItem.size,
      repeatItemCount,
      openCount,
      washedCount: washed.length,
      bypassedCount,
      avgTurnaroundHours,
      fromWardCount,
      topStatus: byStatus[0] ?? null,
      topWard: topWard ? { wardName: topWard.wardName, count: topWard.count, pct: topWard.pct } : null,
    },
    byStatus,
    byWard,
    byCategory,
    byReason,
    trend,
    repeatItems,
    recent,
    recentTruncated: total > RECENT_LIMIT,
  };
}
