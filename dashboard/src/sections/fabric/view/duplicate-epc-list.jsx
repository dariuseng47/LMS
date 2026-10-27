import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import AlertTitle from '@mui/material/AlertTitle';

// ----------------------------------------------------------------------

// รายการ EPC ที่ซ้ำกับในระบบ — ชิปแดงพร้อมประเภทผ้า (ของโรงพยาบาลอื่นไม่เปิดเผยประเภท)
export function DuplicateEpcList({ duplicates }) {
  if (!duplicates.length) return null;

  return (
    <Alert severity="error" variant="outlined">
      <AlertTitle>EPC ซ้ำในระบบ {duplicates.length} รายการ — จะไม่ถูกลงทะเบียน</AlertTitle>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {duplicates.map((d) => (
          <Chip
            key={d.epcCode}
            size="small"
            color="error"
            variant="soft"
            label={`${d.epcCode} — ${
              d.otherHospital ? 'ลงทะเบียนที่โรงพยาบาลอื่นแล้ว' : d.categoryName || 'ไม่ระบุประเภท'
            }`}
          />
        ))}
      </Stack>
    </Alert>
  );
}
