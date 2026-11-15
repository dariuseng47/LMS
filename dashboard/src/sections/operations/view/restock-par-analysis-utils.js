// ค่าคงที่/ตัวช่วยของแท็บ "วิเคราะห์ Par" — แยกจาก component ให้ไฟล์ไม่ยาวเกินไป
// สูตรทั้งหมดคำนวณฝั่ง server (server/src/controllers/parAnalysis.controller.js) ไฟล์นี้แค่จัดแสดงผล

// สีของสถานะเทียบ Par ใช้ชุดเดียวกับแอป handheld: เกิน = ฟ้า (info), ขาด = เหลือง (warning), ครบ = เขียว
export const VERDICT_META = {
  reduce: {
    label: 'ควรลด Par',
    color: 'info',
    icon: 'solar:double-alt-arrow-down-bold-duotone',
    hint: 'ใช้จริงต่อรอบน้อยกว่า Par มาก — ผ้ากองค้างในตู้ ลด Par ลงได้',
  },
  increase: {
    label: 'ควรเพิ่ม Par',
    color: 'warning',
    icon: 'solar:double-alt-arrow-up-bold-duotone',
    hint: 'ใช้จริงต่อรอบมากกว่า Par — มีโอกาสผ้าหมดตู้ก่อนรอบเติมถัดไป',
  },
  ok: {
    label: 'เหมาะสม',
    color: 'success',
    icon: 'solar:check-circle-bold-duotone',
    hint: 'Par ใกล้เคียงกับยอดใช้จริงต่อรอบแล้ว',
  },
  insufficient: {
    label: 'ข้อมูลยังน้อย',
    color: 'default',
    icon: 'solar:hourglass-bold-duotone',
    hint: 'ต้องมีรอบเติมต่อเนื่องอย่างน้อย 3 รอบก่อน ระบบถึงจะแนะนำ Par ได้',
  },
  no_par: {
    label: 'ยังไม่ตั้ง Par',
    color: 'default',
    icon: 'solar:danger-triangle-bold-duotone',
    hint: 'มีการเติมผ้าชนิดนี้เข้าตู้ แต่ตู้นี้ยังไม่ได้ตั้ง Par ของชนิดนี้',
  },
};

export const FILTERS = [
  { value: 'all', label: 'ทั้งหมด', match: () => true },
  { value: 'over', label: 'เคยเกิน Par', match: (r) => r.overRounds > 0 },
  { value: 'reduce', label: 'ควรลด Par', match: (r) => r.verdict === 'reduce' },
  { value: 'increase', label: 'ควรเพิ่ม Par', match: (r) => r.verdict === 'increase' },
  { value: 'no_par', label: 'ยังไม่ตั้ง Par', match: (r) => r.verdict === 'no_par' },
];

export const rowKey = (r) => `${r.cabinetId}::${r.categoryId}`;

const dash = (v) => (v == null ? '-' : v);

export function buildParAnalysisExcel({ rows, hospitalName, scopeLabel, rangeLabel }) {
  return {
    sheetName: 'วิเคราะห์ Par',
    title: 'สถิติผ้าเกิน Par & Par แนะนำ',
    subtitle: [hospitalName, scopeLabel, rangeLabel].filter(Boolean).join(' · '),
    columns: [
      { key: 'buildingName', label: 'ตึก', width: 120 },
      { key: 'wardName', label: 'แผนก/วอร์ด', width: 140 },
      { key: 'cabinetName', label: 'ตู้', width: 110 },
      { key: 'categoryName', label: 'ชนิดผ้า', width: 140 },
      { key: 'par', label: 'Par ปัจจุบัน', width: 90 },
      { key: 'rounds', label: 'จำนวนรอบ', width: 80 },
      { key: 'overRounds', label: 'รอบที่เกิน Par', width: 100 },
      { key: 'overRate', label: '% รอบที่เกิน', width: 90 },
      { key: 'overQtyTotal', label: 'เกินรวม (ชิ้น)', width: 100 },
      { key: 'overQtyMax', label: 'เกินสูงสุด (ชิ้น)', width: 110 },
      { key: 'avgBefore', label: 'ก่อนเติมเฉลี่ย', width: 100 },
      { key: 'avgAfter', label: 'หลังเติมเฉลี่ย', width: 100 },
      { key: 'avgUsage', label: 'ใช้ต่อรอบเฉลี่ย', width: 110 },
      { key: 'maxUsage', label: 'ใช้ต่อรอบสูงสุด', width: 110 },
      { key: 'suggested', label: 'Par แนะนำ', width: 90 },
      { key: 'verdict', label: 'ข้อเสนอ', width: 120 },
    ],
    rows: rows.map((r) => ({
      buildingName: r.buildingName,
      wardName: r.wardName,
      cabinetName: r.cabinetName,
      categoryName: r.categoryName,
      par: dash(r.parQty),
      rounds: r.rounds,
      overRounds: r.parQty == null ? '-' : r.overRounds,
      overRate: r.parQty == null ? '-' : r.overRate,
      overQtyTotal: r.parQty == null ? '-' : r.overQtyTotal,
      overQtyMax: r.parQty == null ? '-' : r.overQtyMax,
      avgBefore: r.avgBefore,
      avgAfter: r.avgAfter,
      avgUsage: dash(r.avgUsage),
      maxUsage: dash(r.maxUsage),
      suggested: dash(r.suggestedPar),
      verdict: VERDICT_META[r.verdict]?.label ?? r.verdict,
    })),
  };
}
