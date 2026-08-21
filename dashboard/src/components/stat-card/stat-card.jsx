import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// สต๊อกการ์ดสรุปตัวเลขแบบมาตรฐาน ใช้ร่วมกันทุกหน้า dashboard (ภาพรวมเดี่ยว/ภาพรวมข้ามโรงพยาบาล)
// เพื่อให้ภาษาภาพ (visual language) สม่ำเสมอทั้งระบบ
export function StatCard({ icon, title, value, color = 'primary', sx }) {
  return (
    <Card sx={sx}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Stack
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: '50%',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => theme.vars.palette[color].lighter,
            color: (theme) => theme.vars.palette[color].dark,
          }}
        >
          <Iconify icon={icon} width={24} />
        </Stack>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
            {title}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
