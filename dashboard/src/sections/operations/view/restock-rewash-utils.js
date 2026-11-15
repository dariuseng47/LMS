import { fDateTime } from 'src/utils/format-time';

import { STATUS_LABEL, formatRewashReason } from '../../fabric/fabric-constants';

// ----------------------------------------------------------------------

// สีประจำ "สถานะต้นทาง" ของแท็บประวัติผ้าส่งซักใหม่ — สีตามสถานะเสมอ (ไม่ใช่ตามอันดับ) ทุกกราฟ/รายการ
// ในแท็บนี้ใช้ชุดเดียวกัน แยกค่าโหมดสว่าง/มืด (ผ่าน validator ของ dataviz: lightness/CVD/contrast ทั้งสองโหมด)
// โทนเดียวกับการ์ดขั้นตอนหลักหน้า Process Monitor (WASH อำพัน, สต๊อกกลาง เขียว, ตู้แผนก ฟ้า, วอร์ด ม่วง)
const SOURCE_STATUS_COLORS = {
  light: {
    WASH: '#B76E00',
    CENTRAL_STOCK: '#00A76F',
    WARD_CABINET: '#006C9C',
    IN_USE_WARD: '#8E33FF',
  },
  dark: {
    WASH: '#C98500',
    CENTRAL_STOCK: '#00A76F',
    WARD_CABINET: '#1E90C0',
    IN_USE_WARD: '#A35BFF',
  },
};

export function sourceStatusColor(status, mode = 'light', fallback = '#919EAB') {
  return SOURCE_STATUS_COLORS[mode === 'dark' ? 'dark' : 'light'][status] ?? fallback;
}

// ข้อความสถานะต้นทางแบบสั้น อ่านง่ายในบริบท "เจอผ้าสกปรกตอนไหน"
export const SOURCE_STATUS_HINT = {
  WASH: 'เจอหลังซัก (ฝ่ายซัก)',
  CENTRAL_STOCK: 'เจอในสต๊อกกลาง',
  WARD_CABINET: 'เจอในตู้แผนก',
  IN_USE_WARD: 'เจอที่วอร์ดตอนใช้งาน',
};

export function closeStateLabel(row) {
  if (row.closeType === 'WASHED') return 'ซักแล้ว';
  if (row.closeType === 'BYPASSED') return 'ไม่ผ่านการซัก';
  if (row.currentStatus === 'REWASH') return 'รอซัก';
  return STATUS_LABEL[row.currentStatus] ?? row.currentStatus ?? '-';
}

export function formatHours(hours) {
  if (hours == null) return '-';
  if (hours < 1) return `${Math.round(hours * 60)} นาที`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} ชม.`;
  return `${Math.round((hours / 24) * 10) / 10} วัน`;
}

// Export Excel — 3 ชีท: สรุปตามแผนก, สรุปตามสถานะต้นทาง, รายการส่งซักใหม่ (ตามที่โหลดมา ≤ 500 ล่าสุด)
export function buildRewashExcelSheets({
  byWard,
  byStatus,
  recent,
  hospitalName,
  scopeLabel,
  rangeLabel,
}) {
  const subtitle = [hospitalName, scopeLabel, rangeLabel].filter(Boolean).join(' · ');
  return [
    {
      sheetName: 'ตามแผนก',
      title: 'ผ้าส่งซักใหม่ — สรุปตามแผนก/วอร์ดต้นทาง',
      subtitle,
      columns: [
        { key: 'buildingName', label: 'ตึก', width: 120 },
        { key: 'wardName', label: 'แผนก/วอร์ด', width: 200 },
        { key: 'count', label: 'ส่งซักใหม่ (ครั้ง)', width: 110 },
        { key: 'pct', label: '% ของทั้งหมด', width: 90 },
        { key: 'uniqueItems', label: 'จำนวนชิ้น', width: 90 },
        { key: 'wardCabinet', label: 'จากตู้แผนก', width: 90 },
        { key: 'inUse', label: 'จากวอร์ดใช้งาน', width: 100 },
        { key: 'topCategory', label: 'ประเภทที่พบบ่อย', width: 160 },
      ],
      rows: byWard.map((w) => ({
        buildingName: w.buildingName,
        wardName: w.wardName,
        count: w.count,
        pct: w.pct,
        uniqueItems: w.uniqueItems,
        wardCabinet: w.byStatus?.WARD_CABINET ?? 0,
        inUse: w.byStatus?.IN_USE_WARD ?? 0,
        topCategory: w.topCategory ? `${w.topCategory.name} (${w.topCategory.count})` : '-',
      })),
    },
    {
      sheetName: 'ตามสถานะต้นทาง',
      title: 'ผ้าส่งซักใหม่ — สรุปตามสถานะก่อนส่ง',
      subtitle,
      columns: [
        { key: 'status', label: 'สถานะก่อนส่งซักใหม่', width: 200 },
        { key: 'count', label: 'ครั้ง', width: 90 },
        { key: 'pct', label: '%', width: 70 },
      ],
      rows: byStatus.map((s) => ({
        status: STATUS_LABEL[s.status] ?? s.status,
        count: s.count,
        pct: s.pct,
      })),
    },
    {
      sheetName: 'รายการ',
      title: 'รายการผ้าส่งซักใหม่',
      subtitle,
      columns: [
        { key: 'createdAt', label: 'วันเวลาที่ส่ง', width: 140 },
        { key: 'epcCode', label: 'รหัส EPC', width: 200 },
        { key: 'categoryName', label: 'ประเภทผ้า', width: 140 },
        { key: 'prevStatus', label: 'สถานะก่อนส่ง', width: 160 },
        { key: 'wardName', label: 'แผนก/วอร์ด', width: 160 },
        { key: 'cabinetName', label: 'ตู้', width: 110 },
        { key: 'reason', label: 'เหตุผล', width: 140 },
        { key: 'userName', label: 'ผู้ส่ง', width: 140 },
        { key: 'state', label: 'ผล', width: 100 },
        { key: 'closedAt', label: 'ซัก/ปิดเมื่อ', width: 140 },
      ],
      rows: recent.map((r) => ({
        createdAt: fDateTime(r.createdAt),
        epcCode: r.epcCode,
        categoryName: r.categoryName ?? '-',
        prevStatus: STATUS_LABEL[r.prevStatus] ?? r.prevStatus,
        wardName: r.wardName ?? '-',
        cabinetName: r.cabinetName ?? '-',
        reason: formatRewashReason(r.reasonCode),
        userName: r.userName ?? '-',
        state: closeStateLabel(r),
        closedAt: r.closedAt ? fDateTime(r.closedAt) : '-',
      })),
    },
  ];
}
