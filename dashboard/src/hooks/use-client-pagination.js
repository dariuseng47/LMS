import { useMemo, useState, useEffect, useCallback } from 'react';

// ----------------------------------------------------------------------

// แบ่งหน้าฝั่ง client — ใช้กับตารางที่ server ส่งมาเป็นก้อนเดียวอยู่แล้ว (มีเพดานแถวฝั่ง server)
// แต่ render ทีเดียวหลายร้อยแถวแล้วหน้าหน่วง: render แค่หน้าปัจจุบัน ส่วน export ยังใช้ rows เต็มเหมือนเดิม
// ใช้คู่กับ <TablePaginationBar {...pagination} /> (src/components/table/table-pagination-bar.jsx)
//
// resetKey: เปลี่ยนค่าเมื่อไหร่ (เช่น ตัวกรอง/คำค้น) กลับไปหน้าแรก — ถ้าแถวหดจนหน้าปัจจุบันว่าง
// (เช่น socket รีเฟรชแล้วรายการหายไป) จะถอยไปหน้าสุดท้ายที่ยังมีข้อมูลให้เอง
export function useClientPagination(rows, { defaultRowsPerPage = 25, resetKey } = {}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);

  const count = rows?.length ?? 0;

  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  const lastPage = Math.max(0, Math.ceil(count / rowsPerPage) - 1);
  const safePage = Math.min(page, lastPage);

  const pageRows = useMemo(
    () => (rows ?? []).slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [rows, safePage, rowsPerPage]
  );

  const onPageChange = useCallback((_, next) => setPage(next), []);

  const onRowsPerPageChange = useCallback((event) => {
    setRowsPerPage(Number(event.target.value));
    setPage(0);
  }, []);

  return {
    pageRows,
    pagination: { count, page: safePage, rowsPerPage, onPageChange, onRowsPerPageChange },
  };
}
