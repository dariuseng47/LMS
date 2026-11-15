import { pool } from '../db/pool.js';
import { resolveTenantId } from '../utils/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

import { fetchWardDirectory, resolveScopeWards } from './restockFillHistory.controller.js';

// แท็บ "วิเคราะห์ Par" (หน้า ประวัติ & วิเคราะห์การเติมผ้า) + คำแนะนำใน dialog ตั้ง Par ของตู้
// สถิติผ้าเกิน/ขาด Par ราย (ตู้ x ชนิดผ้า) จาก "รอบจ่ายผ้า" (ward_issue_rounds) ให้แอดมินใช้ตัดสินใจปรับ Par
//
// ต่อ 1 รอบ ต่อ 1 ชนิดผ้า:
//   ก่อนเติม  = ผ้าที่สแกนเจอในตู้ตอนตรวจนับ (CABINET_AUDIT ของรอบนั้น)
//   เติม      = ผ้าที่จ่ายเข้าตู้ในรอบนั้น (WARD_ISSUE) ไม่นับชิ้นที่สแกนเจอในตู้อยู่แล้วตอนตรวจนับ
//               (เช่น กด "โอนผ้าเข้าแผนกนี้" ให้ชิ้น anomaly — ชิ้นนั้นอยู่ในตู้จริงอยู่แล้ว ไม่ใช่ของเติมใหม่)
//   หลังเติม  = ก่อนเติม + เติม
//   เกิน Par  = max(หลังเติม - Par, 0)    — Par ใช้ค่า ณ ตอนตรวจนับ (par_snapshot) ไม่ใช่ค่าปัจจุบัน
//   ใช้ไป     = หลังเติมของรอบก่อนหน้า (ตู้เดียวกัน) - ก่อนเติมของรอบนี้  = ผ้าที่ออกจากตู้ระหว่างสองรอบ
//
// Par แนะนำ = ปัดขึ้น(ยอดใช้ไปต่อรอบ ที่เปอร์เซ็นไทล์ 90 x 1.2) — ให้ตู้มีพอใช้ระหว่างรอบเติมเกือบทุกครั้ง
// + เผื่อ 20% ต้องมีตัวอย่าง "ใช้ไป" อย่างน้อย MIN_USAGE_SAMPLES รอบก่อน ไม่งั้นถือว่าข้อมูลยังน้อย

export const MIN_USAGE_SAMPLES = 3;
export const SAFETY_FACTOR = 1.2;
const USAGE_PERCENTILE = 0.9;
// ถือว่า "เปลี่ยนแนะนำ" เมื่อห่างจาก Par ปัจจุบันเกินทั้ง 15% และ 2 ชิ้น (กัน Par เล็กๆ แกว่งตามเศษ)
const ADJUST_RATIO = 0.15;
const ADJUST_MIN_DIFF = 2;
// รอบที่ไม่ได้เติมอะไรเลยแล้วมีรอบใหม่ของตู้เดียวกันตามมาภายในเวลานี้ = ตรวจนับซ้ำ (เช่น กดเลือกตู้ใหม่
// แล้วตรวจนับใหม่) ข้ามรอบเก่าทิ้ง ไม่งั้นจะได้ตัวอย่าง "ใช้ไป = 0" ปลอมๆ กดค่าแนะนำให้ต่ำลง
const SUPERSEDED_WITHIN_MS = 30 * 60 * 1000;
// รอบ "ล่าสุด" ที่ส่งกลับไปให้ดูรายละเอียดต่อแถว
const DETAIL_ROUNDS_LIMIT = 20;
// เกินบ่อย = รอบที่เกิน Par ตั้งแต่ 30% ของรอบทั้งหมด (และมีอย่างน้อย 3 รอบ)
const FREQUENT_OVER_RATIO = 0.3;

function toDate(value) {
  return value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
}

function parseSnapshot(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// เปอร์เซ็นไทล์แบบ nearest-rank (ข้อมูลน้อย อธิบายง่ายกว่า interpolate)
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

const round1 = (n) => Math.round(n * 10) / 10;

export function suggestPar(usageSamples) {
  if (usageSamples.length < MIN_USAGE_SAMPLES) return null;
  return Math.max(1, Math.ceil(percentile(usageSamples, USAGE_PERCENTILE) * SAFETY_FACTOR));
}

export function verdictFor(parQty, suggestedPar) {
  if (parQty == null) return 'no_par';
  if (suggestedPar == null) return 'insufficient';
  const diff = suggestedPar - parQty;
  if (diff >= ADJUST_MIN_DIFF && diff > parQty * ADJUST_RATIO) return 'increase';
  if (-diff >= ADJUST_MIN_DIFF && -diff > parQty * ADJUST_RATIO) return 'reduce';
  return 'ok';
}

/**
 * @param cabinets  [{ cabinetId, cabinetName, wardId, wardName, buildingName }]
 * @param parRows   Par ปัจจุบัน [{ cabinet_id, category_id, par_level_qty }]
 * @param rounds    [{ id, cabinet_id, created_at, par_snapshot }] — รวมรอบก่อนช่วงเวลา (ใช้หา "ใช้ไป" ของรอบแรก)
 * @param scanLogs  [{ round_id, event_type, fabric_item_id, category_id }]
 * @param categoryNameById Map
 * @param from/to   ขอบเขตช่วงเวลา (Date) — นับสถิติเฉพาะรอบที่อยู่ในช่วงนี้
 */
export function buildParAnalysis({ cabinets, parRows, rounds, scanLogs, categoryNameById, from, to }) {
  const currentPar = new Map(); // `${cabinetId}::${categoryId}` -> qty
  for (const row of parRows) currentPar.set(`${row.cabinet_id}::${row.category_id}`, Number(row.par_level_qty));

  // roundId -> { audit: Map(cat -> Set(item)), issue: Map(cat -> Set(item)) }
  const logsByRound = new Map();
  for (const log of scanLogs) {
    if (log.category_id == null) continue; // eslint-disable-line no-continue
    if (!logsByRound.has(log.round_id)) logsByRound.set(log.round_id, { audit: new Map(), issue: new Map() });
    const bucket = logsByRound.get(log.round_id)[log.event_type === 'CABINET_AUDIT' ? 'audit' : 'issue'];
    if (!bucket.has(log.category_id)) bucket.set(log.category_id, new Set());
    bucket.get(log.category_id).add(log.fabric_item_id);
  }

  const roundsByCabinet = new Map();
  for (const round of rounds) {
    if (!roundsByCabinet.has(round.cabinet_id)) roundsByCabinet.set(round.cabinet_id, []);
    roundsByCabinet.get(round.cabinet_id).push({ ...round, at: toDate(round.created_at) });
  }

  const rows = [];
  const overRoundIds = new Set();
  const analyzedRoundIds = new Set();

  for (const cabinet of cabinets) {
    const cabinetRounds = (roundsByCabinet.get(cabinet.cabinetId) || []).sort((a, b) => a.at - b.at || a.id - b.id);
    const perCategory = new Map(); // categoryId -> accumulator
    const prevAfter = new Map(); // categoryId -> หลังเติมของรอบก่อนหน้า

    const ensure = (categoryId) => {
      if (!perCategory.has(categoryId)) {
        perCategory.set(categoryId, {
          rounds: 0,
          overRounds: 0,
          overFillRounds: 0,
          carryOverRounds: 0,
          shortRounds: 0,
          overQtyTotal: 0,
          overQtyMax: 0,
          sumBefore: 0,
          sumAfter: 0,
          usage: [],
          details: [],
        });
      }
      return perCategory.get(categoryId);
    };

    cabinetRounds.forEach((round, idx) => {
      const logs = logsByRound.get(round.id);
      // ตรวจนับตู้เปล่าแล้วไม่ได้เติมอะไร = รอบที่ถูกทิ้ง ไม่มีข้อมูลให้วิเคราะห์
      if (!logs) return;

      const filledTotal = [...logs.issue.values()].reduce((sum, set) => sum + set.size, 0);
      const next = cabinetRounds[idx + 1];
      if (filledTotal === 0 && next && next.at - round.at < SUPERSEDED_WITHIN_MS) return;

      const snapshot = parseSnapshot(round.par_snapshot);
      const parFor = (categoryId) => {
        if (snapshot) return snapshot[String(categoryId)] ?? null;
        return currentPar.get(`${cabinet.cabinetId}::${categoryId}`) ?? null;
      };

      const categoryIds = new Set([...logs.audit.keys(), ...logs.issue.keys()]);
      if (snapshot) Object.keys(snapshot).forEach((k) => categoryIds.add(Number(k)));
      else {
        parRows
          .filter((r) => r.cabinet_id === cabinet.cabinetId)
          .forEach((r) => categoryIds.add(Number(r.category_id)));
      }

      const inRange = round.at >= from && round.at <= to;
      if (inRange) analyzedRoundIds.add(round.id);

      for (const categoryId of categoryIds) {
        const audited = logs.audit.get(categoryId) || new Set();
        const issued = logs.issue.get(categoryId) || new Set();
        const before = audited.size;
        const filled = [...issued].filter((itemId) => !audited.has(itemId)).length;
        const after = before + filled;
        const used = prevAfter.has(categoryId) ? Math.max(prevAfter.get(categoryId) - before, 0) : null;
        prevAfter.set(categoryId, after);

        if (!inRange) continue; // eslint-disable-line no-continue

        const par = parFor(categoryId);
        const acc = ensure(categoryId);
        acc.rounds += 1;
        acc.sumBefore += before;
        acc.sumAfter += after;
        if (used != null) acc.usage.push(used);

        let overQty = null;
        if (par != null) {
          overQty = Math.max(after - par, 0);
          if (overQty > 0) {
            acc.overRounds += 1;
            acc.overQtyTotal += overQty;
            acc.overQtyMax = Math.max(acc.overQtyMax, overQty);
            overRoundIds.add(round.id);
          }
          if (before > par) acc.carryOverRounds += 1;
          if (filled > Math.max(par - before, 0)) acc.overFillRounds += 1;
          if (after < par) acc.shortRounds += 1;
        }

        acc.details.push({ roundId: round.id, at: round.created_at, par, before, filled, after, overQty, used });
      }
    });

    for (const [categoryId, acc] of perCategory) {
      const parQty = currentPar.get(`${cabinet.cabinetId}::${categoryId}`) ?? null;
      const suggestedPar = suggestPar(acc.usage);
      const verdict = verdictFor(parQty, suggestedPar);
      rows.push({
        cabinetId: cabinet.cabinetId,
        cabinetName: cabinet.cabinetName,
        wardId: cabinet.wardId,
        wardName: cabinet.wardName,
        buildingName: cabinet.buildingName,
        categoryId,
        categoryName: categoryNameById.get(categoryId) ?? 'ไม่ระบุประเภท',
        parQty,
        rounds: acc.rounds,
        overRounds: acc.overRounds,
        overRate: acc.rounds > 0 ? round1((acc.overRounds / acc.rounds) * 100) : 0,
        overQtyTotal: acc.overQtyTotal,
        overQtyMax: acc.overQtyMax,
        overFillRounds: acc.overFillRounds,
        carryOverRounds: acc.carryOverRounds,
        shortRounds: acc.shortRounds,
        avgBefore: acc.rounds > 0 ? round1(acc.sumBefore / acc.rounds) : 0,
        avgAfter: acc.rounds > 0 ? round1(acc.sumAfter / acc.rounds) : 0,
        usageSamples: acc.usage.length,
        avgUsage: acc.usage.length > 0 ? round1(acc.usage.reduce((s, v) => s + v, 0) / acc.usage.length) : null,
        maxUsage: acc.usage.length > 0 ? Math.max(...acc.usage) : null,
        suggestedPar,
        verdict,
        frequentOver: acc.rounds >= 3 && acc.overRounds / acc.rounds >= FREQUENT_OVER_RATIO,
        recentRounds: acc.details.slice(-DETAIL_ROUNDS_LIMIT).reverse(),
      });
    }
  }

  rows.sort(
    (a, b) =>
      b.overQtyTotal - a.overQtyTotal ||
      b.overRounds - a.overRounds ||
      a.wardName.localeCompare(b.wardName, 'th') ||
      a.cabinetName.localeCompare(b.cabinetName, 'th') ||
      a.categoryName.localeCompare(b.categoryName, 'th')
  );

  return { summary: summarize(rows, analyzedRoundIds.size, overRoundIds.size), rows };
}

function summarize(rows, roundsAnalyzed = 0, overRounds = 0) {
  return {
    roundsAnalyzed,
    overRounds,
    overQtyTotal: rows.reduce((s, r) => s + r.overQtyTotal, 0),
    reduceSuggested: rows.filter((r) => r.verdict === 'reduce').length,
    increaseSuggested: rows.filter((r) => r.verdict === 'increase').length,
    noParCount: rows.filter((r) => r.verdict === 'no_par').length,
  };
}

function buildDateRange(startDate, endDate) {
  const fmt = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  const fromDay = startDate || fmt(monthAgo);
  const toDay = endDate || fmt(today);
  return { from: `${fromDay} 00:00:00`, to: `${toDay} 23:59:59` };
}

/**
 * GET /api/v1/restock-report/par-analysis — ทุก role ที่ดูรายงานการเติมผ้าได้ (อ่านอย่างเดียว)
 * ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (ไม่ส่ง = 30 วันล่าสุด) &buildingId=&wardIds=1,2&cabinetId=
 */
export const getParAnalysis = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { from, to } = buildDateRange(req.query.startDate, req.query.endDate);
  const { buildingId, wardIds, cabinetId } = req.query;

  const wardDirectory = await fetchWardDirectory(tenantId);
  const scopeWards = resolveScopeWards(wardDirectory, buildingId, wardIds);
  const wardById = new Map(scopeWards.map((w) => [w.wardId, w]));
  const empty = { range: { from, to }, summary: summarize([]), rows: [] };
  if (wardById.size === 0) return res.json(empty);

  const wardIdList = [...wardById.keys()];
  const [cabinetRows] = await pool.query(
    `SELECT id, name, department_id FROM cabinets
     WHERE hospital_id = ? AND deleted_at IS NULL
       AND department_id IN (${wardIdList.map(() => '?').join(',')})
       ${cabinetId ? 'AND id = ?' : ''}`,
    [tenantId, ...wardIdList, ...(cabinetId ? [cabinetId] : [])]
  );
  if (cabinetRows.length === 0) return res.json(empty);

  const cabinets = cabinetRows.map((c) => {
    const ward = wardById.get(c.department_id);
    return {
      cabinetId: c.id,
      cabinetName: c.name,
      wardId: c.department_id,
      wardName: ward?.wardName ?? '-',
      buildingName: ward?.buildingName ?? 'ไม่ทราบตึก',
    };
  });
  const cabinetIds = cabinets.map((c) => c.cabinetId);
  const inCabinets = cabinetIds.map(() => '?').join(',');

  const [[parRows], [rounds], [categoryRows]] = await Promise.all([
    pool.query(
      `SELECT cabinet_id, fabric_category_id AS category_id, par_level_qty
       FROM cabinet_par_levels WHERE cabinet_id IN (${inCabinets})`,
      cabinetIds
    ),
    // รอบในช่วง + รอบล่าสุดก่อนช่วงของแต่ละตู้ (ใช้คำนวณ "ใช้ไป" ของรอบแรกในช่วง)
    pool.query(
      `SELECT id, cabinet_id, created_at, par_snapshot FROM ward_issue_rounds
       WHERE hospital_id = ? AND cabinet_id IN (${inCabinets})
         AND (created_at BETWEEN ? AND ?
              OR id IN (SELECT MAX(id) FROM ward_issue_rounds
                        WHERE hospital_id = ? AND cabinet_id IN (${inCabinets}) AND created_at < ?
                        GROUP BY cabinet_id))`,
      [tenantId, ...cabinetIds, from, to, tenantId, ...cabinetIds, from]
    ),
    pool.query('SELECT id, name FROM fabric_categories WHERE hospital_id = ?', [tenantId]),
  ]);

  let scanLogs = [];
  if (rounds.length > 0) {
    const roundIds = rounds.map((r) => r.id);
    [scanLogs] = await pool.query(
      `SELECT sl.round_id, sl.event_type, sl.fabric_item_id, fi.fabric_category_id AS category_id
       FROM scan_logs sl
       JOIN fabric_items fi ON fi.id = sl.fabric_item_id
       WHERE sl.hospital_id = ? AND sl.event_type IN ('CABINET_AUDIT', 'WARD_ISSUE')
         AND sl.round_id IN (${roundIds.map(() => '?').join(',')})`,
      [tenantId, ...roundIds]
    );
  }

  const { summary, rows } = buildParAnalysis({
    cabinets,
    parRows,
    rounds,
    scanLogs,
    categoryNameById: new Map(categoryRows.map((c) => [c.id, c.name])),
    from: toDate(from),
    to: toDate(to),
  });

  return res.json({ range: { from, to }, summary, rows });
});
