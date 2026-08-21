import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { CONFIG } from 'src/config-global';
import { varAlpha, bgGradient } from 'src/theme/styles';

// ----------------------------------------------------------------------

// พาเนลซ้ายของหน้า login — บล็อกสีเข้มเต็มพื้นที่ + ภาพประกอบตรงกลาง + ข้อความอธิบายด้านล่าง
// (ปรับสัดส่วน/เลย์เอาต์ตามภาพตัวอย่างที่ผู้ใช้ส่งมา แทนของเดิมที่เป็นพื้นหลังจางๆ)
export function Section({
  sx,
  layoutQuery,
  title = 'ระบบบริหารจัดการผ้า',
  imgUrl = `${CONFIG.assetsDir}/assets/illustrations/illustration-dashboard.webp`,
  subtitle,
  ...other
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        ...bgGradient({
          color: `135deg, ${varAlpha(theme.vars.palette.primary.darkChannel, 0.96)}, ${varAlpha(
            theme.vars.palette.primary.mainChannel,
            0.96
          )}`,
        }),
        px: 3,
        pb: 3,
        width: 1,
        display: 'none',
        position: 'relative',
        [theme.breakpoints.up(layoutQuery)]: {
          gap: 6,
          flex: '2 1 0%',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          justifyContent: 'center',
        },
        ...sx,
      }}
      {...other}
    >
      <Box
        component="img"
        alt="ภาพประกอบระบบ"
        src={imgUrl}
        sx={{ width: 1, maxWidth: 560, aspectRatio: '521/479', objectFit: 'contain' }}
      />

      <Box sx={{ maxWidth: 520 }}>
        <Typography variant="h4" sx={{ textAlign: 'center', color: 'common.white' }}>
          {title}
        </Typography>

        {subtitle && (
          <Typography
            sx={{
              mt: 2,
              textAlign: 'center',
              color: varAlpha(theme.vars.palette.common.whiteChannel, 0.8),
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
