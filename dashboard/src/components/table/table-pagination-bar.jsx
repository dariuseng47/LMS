import TablePagination from '@mui/material/TablePagination';

// ----------------------------------------------------------------------

export const DEFAULT_ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// แถบเปลี่ยนหน้าท้ายตาราง (ป้ายภาษาไทย) — ใช้ได้ทั้งแบ่งหน้าฝั่ง client (useClientPagination)
// และฝั่ง server (count = total จาก API) ซ่อนตัวเองถ้าไม่มีข้อมูล
export function TablePaginationBar({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE_OPTIONS,
  sx,
}) {
  if (!count) return null;

  return (
    <TablePagination
      component="div"
      count={count}
      page={page}
      rowsPerPage={rowsPerPage}
      rowsPerPageOptions={rowsPerPageOptions}
      onPageChange={onPageChange}
      onRowsPerPageChange={onRowsPerPageChange}
      labelRowsPerPage="แถวต่อหน้า"
      labelDisplayedRows={({ from, to, count: total }) =>
        `${from.toLocaleString()}–${to.toLocaleString()} จาก ${total.toLocaleString()}`
      }
      sx={{ borderTop: (theme) => `dashed 1px ${theme.vars.palette.divider}`, ...sx }}
    />
  );
}
