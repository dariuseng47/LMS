import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

// ----------------------------------------------------------------------

// เฉพาะ superadmin เท่านั้นที่เห็น dropdown นี้ (admin/operator มี tenant ของตัวเองอยู่แล้ว)
export function HospitalSelector({ hospitals, value, onChange, sx }) {
  return (
    <TextField
      select
      size="small"
      label="โรงพยาบาล"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      sx={{ minWidth: 240, ...sx }}
    >
      {hospitals.map((hospital) => (
        <MenuItem key={hospital.id} value={hospital.id}>
          {hospital.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
