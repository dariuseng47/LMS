'use client';

import { useState } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { FabricDateRangeFilter } from './fabric-date-range-filter';

// ----------------------------------------------------------------------

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// แถบตัวกรองวันที่ + ปุ่ม Export Excel/PDF — ใช้ร่วมกันทุกเมนูย่อยของ "จัดการผ้าและล็อต"
// (คลังผ้า/ล็อต/พัก-ชำรุด/จำหน่ายออก) เดิมแต่ละหน้าก็อปวาง JSX ชุดนี้แทบทั้งชิ้น
//
// PDF สร้างตอนกดปุ่มเท่านั้น (เดิมใช้ PDFDownloadLink ที่ render PDF ทั้งเล่มใหม่ทุกครั้งที่ข้อมูล/ตัวกรอง
// เปลี่ยน — ผ้าหลายพันชิ้นทำหน้าค้าง) pdfDocument เป็น element หรือฟังก์ชัน (async ได้) ที่คืน element
// ก็ได้ — หน้าที่แบ่งหน้าฝั่ง server ใช้ฟังก์ชันไปดึงข้อมูลทั้งหมดตามตัวกรองก่อนค่อยสร้าง PDF
// onExportExcel เป็น async ได้เช่นกัน ปุ่มจะหมุนรอจนเสร็จ
export function FabricExportToolbar({ dateFilterProps, pdfDocument, pdfFileName, onExportExcel }) {
  const [busy, setBusy] = useState(null); // 'pdf' | 'excel' | null

  const run = async (kind, task) => {
    setBusy(kind);
    try {
      await task();
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Export ไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const handleExportPdf = () =>
    run('pdf', async () => {
      const doc = typeof pdfDocument === 'function' ? await pdfDocument() : pdfDocument;
      if (!doc) return;
      // โหลด @react-pdf/renderer เฉพาะตอนกด — ไลบรารีใหญ่ ไม่ต้องติดมากับหน้าแรก
      const { pdf } = await import('@react-pdf/renderer');
      const blob = await pdf(doc).toBlob();
      downloadBlob(blob, pdfFileName);
    });

  const handleExportExcel = () => run('excel', async () => onExportExcel?.());

  return (
    <Stack
      direction="row"
      spacing={1.5}
      flexWrap="wrap"
      useFlexGap
      alignItems="center"
      justifyContent="space-between"
    >
      <FabricDateRangeFilter {...dateFilterProps} />

      <Stack direction="row" spacing={1.5} alignItems="center">
        <Button
          size="small"
          variant="contained"
          startIcon={
            busy === 'pdf' ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <Iconify icon="solar:file-download-bold-duotone" />
            )
          }
          disabled={!!busy}
          onClick={handleExportPdf}
        >
          Export PDF
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="success"
          startIcon={
            busy === 'excel' ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <Iconify icon="solar:file-text-bold-duotone" />
            )
          }
          disabled={!!busy}
          onClick={handleExportExcel}
        >
          Export Excel
        </Button>
      </Stack>
    </Stack>
  );
}
