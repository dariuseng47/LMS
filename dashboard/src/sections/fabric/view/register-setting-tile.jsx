import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { maxLine, varAlpha } from 'src/theme/styles';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// ปุ่มตั้งค่าแบบการ์ด (ประเภทผ้า / ล็อต / เครื่องสแกน) — เห็นค่าที่เลือกอยู่ตลอด แตะเพื่อเปลี่ยน
// tone: 'warning' = ต้องเลือกแต่ยังไม่เลือก (กรอบส้มเส้นประ) | 'primary' = เลือกแล้ว | 'default' = ไม่บังคับ ยังไม่เลือก
export function RegisterSettingTile({ icon, label, title, detail, tone = 'primary', disabled, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={(theme) => {
        const channel =
          tone === 'default'
            ? theme.vars.palette.grey['500Channel']
            : theme.vars.palette[tone].mainChannel;
        return {
          p: 1.5,
          flex: 1,
          width: 1,
          minWidth: 0,
          minHeight: 84,
          textAlign: 'left',
          borderRadius: 1.5,
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          border: `1px ${tone === 'warning' ? 'dashed' : 'solid'} ${varAlpha(channel, tone === 'warning' ? 0.8 : 0.32)}`,
          bgcolor: varAlpha(channel, tone === 'warning' ? 0.1 : 0.04),
          transition: theme.transitions.create(['background-color']),
          '&:hover': { bgcolor: varAlpha(channel, 0.14) },
          ...(disabled && { opacity: 0.6 }),
        };
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{
            mb: 0.5,
            color:
              (tone === 'warning' && 'warning.dark') ||
              (tone === 'primary' && 'primary.main') ||
              'text.secondary',
          }}
        >
          <Iconify icon={icon} width={20} sx={{ flexShrink: 0 }} />
          <Typography variant="caption" noWrap sx={{ flex: 1, color: 'text.secondary' }}>
            {label}
          </Typography>
          <Iconify icon="eva:arrow-ios-forward-fill" width={18} sx={{ flexShrink: 0 }} />
        </Stack>

        {/* ชื่อเครื่อง/ประเภทผ้ายาวได้ — ตัดขึ้น 2 บรรทัดแทนการตัดคำทิ้ง */}
        <Typography variant="subtitle2" sx={{ lineHeight: 1.4, ...maxLine({ line: 2 }) }}>
          {title}
        </Typography>
        {detail && (
          <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
            {detail}
          </Typography>
        )}
      </Box>
    </ButtonBase>
  );
}
