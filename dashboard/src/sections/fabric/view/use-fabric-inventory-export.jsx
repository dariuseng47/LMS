'use client';

import dayjs from 'dayjs';
import { useCallback } from 'react';

import { sanitizeFileName, exportSheetsToExcel } from 'src/utils/export-excel';

import { toast } from 'src/components/snackbar';

import { STATUS_LABEL } from '../fabric-constants';
import { FabricListReportPDF } from '../fabric-report-pdf';
import { fabricPdfRange, fabricRangeLabel } from '../fabric-export-utils';

// ----------------------------------------------------------------------

// width เป็นตัวเลข (หน่วยเดียวกับ ss:Width ของ Excel) ไม่ใช่ '%' — FabricListReportPDF จะแปลง
// เป็นสัดส่วนให้เอง ห้ามใส่ค่าเป็นสตริงเปอร์เซ็นต์ตรงๆ เพราะไฟล์ Excel จะเสีย (ดู fabric-report-pdf.jsx)
const EXPORT_COLUMNS = [
  { key: 'epc', label: 'รหัส EPC', width: 180 },
  { key: 'category', label: 'ประเภท', width: 150 },
  { key: 'statusLabel', label: 'สถานะ', width: 150 },
  { key: 'department', label: 'แผนก', width: 150 },
  { key: 'washCount', label: 'รอบซัก', width: 90, align: 'right' },
  { key: 'createdBy', label: 'เพิ่มโดย', width: 140 },
  { key: 'createdAt', label: 'วันที่ลงทะเบียน', width: 140 },
];

const SUMMARY_COLUMNS = [
  { key: 'label', label: 'รายการ', width: 400 },
  { key: 'count', label: 'จำนวน (ชิ้น)', width: 200, align: 'right' },
];

// สร้างแถว export + สรุปยอด จากผ้าชุดที่ดึงมาตอนกด export (ทุกแถวตามตัวกรอง ไม่ใช่แค่หน้าที่เห็น)
function buildInventoryReport(items, categoryName) {
  const rows = items.map((item) => ({
    epc: item.epc_code,
    category: categoryName(item.fabric_category_id),
    statusLabel: STATUS_LABEL[item.status] ?? item.status,
    department: item.status === 'WARD_CABINET' ? item.department_name ?? '—' : '-',
    washCount: item.wash_count,
    createdBy: item.created_by_name ?? '—',
    createdAt: new Date(item.created_at).toLocaleDateString('th-TH'),
  }));

  // หน้า/ชีตสรุปยอดรวมท้ายรายงาน — แยกตามประเภทผ้า/สถานะ/แผนก ปิดท้ายด้วยยอดรวมทั้งหมด นับจาก
  // ผ้าชุดเดียวกับตารางหลักในรายงาน ให้ตัวเลขตรงกันเป๊ะ
  const total = items.length;
  const countBy = (getKey) => {
    const map = new Map();
    items.forEach((item) => {
      const key = getKey(item);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  const summarySections = [
    {
      heading: 'แยกตามประเภทผ้า',
      rows: countBy((item) => categoryName(item.fabric_category_id)),
      totalLabel: 'รวมทั้งหมด',
      totalCount: total,
    },
    {
      heading: 'แยกตามสถานะ',
      rows: countBy((item) => STATUS_LABEL[item.status] ?? item.status),
      totalLabel: 'รวมทั้งหมด',
      totalCount: total,
    },
    {
      heading: 'แยกตามแผนก',
      rows: countBy((item) =>
        item.status === 'WARD_CABINET' ? item.department_name ?? 'ไม่ระบุแผนก' : 'ไม่ได้อยู่ที่แผนก'
      ),
      totalLabel: 'รวมทั้งหมด',
      totalCount: total,
    },
  ];

  return { rows, summarySections };
}

// รวม logic เตรียมข้อมูล export (Excel + PDF) ของหน้าคลังผ้าทั้งหมดไว้ที่เดียว — แยกออกจาก
// fabric-inventory-view.jsx เพื่อไม่ให้ไฟล์นั้นยาวเกินไป (มี dialog รายละเอียดผ้าอยู่แล้ว)
//
// ตารางในหน้าโหลดทีละหน้า -> ตอนกด export ค่อยเรียก fetchAllItems() ดึงทุกแถวตามตัวกรองปัจจุบัน
export function useFabricInventoryExport({
  fetchAllItems,
  categories,
  hospitalName,
  registeredFrom,
  registeredTo,
}) {
  const categoryName = useCallback(
    (id) => categories.find((c) => c.id === id)?.name ?? '-',
    [categories]
  );

  const loadReport = async () => {
    const items = await fetchAllItems();
    if (!items.length) {
      toast.warning('ไม่มีผ้าตามเงื่อนไขที่เลือก');
      return null;
    }
    return buildInventoryReport(items, categoryName);
  };

  const rangeLabel = fabricRangeLabel(registeredFrom, registeredTo);
  const pdfRange = fabricPdfRange(registeredFrom, registeredTo);
  const rangeSuffix =
    registeredFrom || registeredTo
      ? `-${dayjs(registeredFrom ?? registeredTo).format('YYYYMMDD')}-${dayjs(registeredTo ?? registeredFrom).format('YYYYMMDD')}`
      : '';
  // ต่อท้ายชื่อไฟล์ด้วยวันที่-เวลาที่กดออก (DDMMYY-HHmm เช่น 130926-1800) กันสับสนเวลา export
  // ซ้ำหลายรอบในเงื่อนไขเดียวกัน — ไม่ใช่วันที่ของข้อมูล (นั่นคือ rangeSuffix ด้านบน)
  const exportedAtSuffix = dayjs().format('DDMMYY-HHmm');
  const exportFileBase = `คลังผ้า${hospitalName ? `-${sanitizeFileName(hospitalName)}` : ''}${rangeSuffix}-${exportedAtSuffix}`;
  const exportSubtitle = [hospitalName, `ช่วงเวลา ${rangeLabel}`].filter(Boolean).join(' · ');

  const handleExportExcel = async () => {
    const report = await loadReport();
    if (!report) return;

    // แปลง summarySections เป็นแถวเดียวสำหรับชีต Excel — ใช้ sectionRowIndexes คั่นหัวข้อกลุ่ม
    // และ totalRowIndexes ไฮไลท์แถวรวมของแต่ละกลุ่ม (ดู export-excel.js)
    const summarySheetRows = [];
    const summarySectionIndexes = [];
    const summaryTotalIndexes = [];
    report.summarySections.forEach((section) => {
      summarySectionIndexes.push(summarySheetRows.length);
      summarySheetRows.push({ sectionLabel: section.heading });
      section.rows.forEach((row) => summarySheetRows.push({ label: row.label, count: row.count }));
      summaryTotalIndexes.push(summarySheetRows.length);
      summarySheetRows.push({ label: section.totalLabel, count: section.totalCount });
    });

    exportSheetsToExcel({
      fileName: exportFileBase,
      sheets: [
        {
          sheetName: 'คลังผ้า',
          title: 'รายงานคลังผ้าทั้งหมด',
          subtitle: exportSubtitle,
          columns: EXPORT_COLUMNS,
          rows: report.rows,
        },
        {
          sheetName: 'สรุปยอดรวม',
          title: 'สรุปยอดรวมคลังผ้า',
          subtitle: exportSubtitle,
          columns: SUMMARY_COLUMNS,
          rows: summarySheetRows,
          totalRowIndexes: summaryTotalIndexes,
          sectionRowIndexes: summarySectionIndexes,
        },
      ],
    });
  };

  // ส่งให้ FabricExportToolbar เป็นฟังก์ชัน — สร้าง PDF ตอนกดปุ่มเท่านั้น
  const getPdfDocument = async () => {
    const report = await loadReport();
    if (!report) return null;
    return (
      <FabricListReportPDF
        title="รายงานคลังผ้าทั้งหมด"
        hospitalName={hospitalName}
        range={pdfRange}
        columns={EXPORT_COLUMNS}
        rows={report.rows}
        summarySections={report.summarySections}
      />
    );
  };

  return {
    categoryName,
    exportFileBase,
    handleExportExcel,
    getPdfDocument,
  };
}
