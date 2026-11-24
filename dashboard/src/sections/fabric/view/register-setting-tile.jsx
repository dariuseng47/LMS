import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { maxLine, varAlpha } from 'src/theme/styles';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// ปุ่มตั้งค่าแบบการ์ด (ผ้าที่จะลงทะเบียน / เครื่องสแกน) — เห็นค่าที่เลือกอยู่ตลอด แตะเพื่อเปลี่ยน
// ยังไม่เลือก (title ว่าง) = กรอบส้มเส้นประ + ข้อความชวนแตะ
export function RegisterSettingTile({
  icon,
  label,
  title,
  detail,
  placeholder,
  action = 'เปลี่ยน',
  disabled,
  onClick,
  sx,
}) {
  const empty = !title;

  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={(theme) => {
        const color = theme.vars.palette[empty ? 'warning' : 'primary'];
        return {
          p: 1.5,
          gap: 1.5,
          flex: 1,
          width: 1,
          minWidth: 0,
          minHeight: 76,
          textAlign: 'left',
          borderRadius: 1.5,
          justifyContent: 'flex-start',
          border: `1px ${empty ? 'dashed' : 'solid'} ${varAlpha(color.mainChannel, empty ? 0.8 : 0.32)}`,
          bgcolor: varAlpha(color.mainChannel, empty ? 0.08 : 0.04),
          transition: theme.transitions.create(['background-color']),
          '&:hover': { bgcolor: varAlpha(color.mainChannel, 0.12) },
          ...(disabled && { opacity: 0.6 }),
          ...sx,
        };
      }}
    >
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={(theme) => ({
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: 1.25,
          color: empty ? 'warning.dark' : 'primary.main',
          bgcolor: varAlpha(theme.vars.palette[empty ? 'warning' : 'primary'].mainChannel, 0.16),
        })}
      >
        <Iconify icon={icon} width={26} />
      </Stack>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
            {label}
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            sx={{
              flexShrink: 0,
              typography: 'caption',
              fontWeight: 'fontWeightBold',
              color: empty ? 'warning.dark' : 'primary.main',
            }}
          >
            {action}
            <Iconify icon="eva:arrow-ios-forward-fill" width={16} />
          </Stack>
        </Stack>
        {/* ชื่อเครื่อง/ประเภทผ้ายาวได้ — ตัดขึ้น 2 บรรทัดแทนการตัดคำทิ้ง */}
        <Typography variant="subtitle2" sx={{ lineHeight: 1.4, ...maxLine({ line: 2 }) }}>
          {title ?? placeholder}
        </Typography>
        {!empty && detail && (
          <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
            {detail}
          </Typography>
        )}
      </Box>
    </ButtonBase>
  );
}
