// ส่งออกตารางเป็นไฟล์ Excel โดยไม่พึ่งไลบรารีภายนอก — สร้างเป็น SpreadsheetML 2003 (.xls)
// ซึ่ง Microsoft Excel / Google Sheets / LibreOffice เปิดได้ตรงๆ และรองรับข้อความภาษาไทย (UTF-8)
// ครบถ้วน ต่างจากการ export CSV ที่ Excel มักตีความ encoding ผิดจนสระ/วรรณยุกต์เพี้ยน

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cellXml(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

/**
 * ดาวน์โหลดข้อมูลเป็นไฟล์ Excel (.xls)
 *
 * @param {object} opts
 * @param {string} opts.fileName            ชื่อไฟล์ (ไม่ต้องใส่ .xls เติมให้เอง)
 * @param {string} [opts.sheetName='Sheet1'] ชื่อชีต
 * @param {{ key: string, label: string }[]} opts.columns  หัวตาราง + คีย์ที่ใช้อ่านค่าจากแต่ละแถว
 * @param {object[]} opts.rows             ข้อมูลแต่ละแถว
 */
export function exportRowsToExcel({ fileName, sheetName = 'Sheet1', columns, rows }) {
  const headerRow = `<Row>${columns.map((col) => cellXml(col.label)).join('')}</Row>`;
  const bodyRows = rows
    .map((row) => `<Row>${columns.map((col) => cellXml(row[col.key])).join('')}</Row>`)
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName).slice(0, 31)}">
  <Table>
   ${headerRow}
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;

  // นำหน้าด้วย BOM (U+FEFF) ให้ Excel รุ่นเก่าบางตัวอ่าน UTF-8 ได้ถูกต้อง
  const blob = new Blob(['\uFEFF', xml], { type: 'application/vnd.ms-excel;charset=UTF-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.toLowerCase().endsWith('.xls') ? fileName : `${fileName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
