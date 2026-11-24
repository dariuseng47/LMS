'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { varAlpha, bgGradient, stylesMode } from 'src/theme/styles';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { ChangeCategoryStepTitle } from './change-category-step-title';

// ----------------------------------------------------------------------

// ประเภทปัจจุบันที่โชว์บนการ์ดสรุป ที่เหลือรวมเป็น "+N ประเภท"
const MAX_SUMMARY_SOURCES = 3;

const formatCount = (n) => n.toLocaleString('th-TH');

// ขั้น 2: ประเภทปลายทาง — ปุ่มใหญ่ปุ่มเดียว แตะแล้วเปิดตัวเลือกแบบการ์ด
export function ChangeCategoryTargetCard({ target, fit, disabled, onOpen }) {
  const theme = useTheme();

  return (
    <Card sx={{ flexShrink: 0 }}>
      <CardContent sx={{ ...(fit && { p: 2, pb: '16px !important' }) }}>
        <ChangeCategoryStepTitle step={2} title="ประเภทปลายทาง" done={!!target} />
        <ButtonBase
          disabled={disabled}
          onClick={onOpen}
          aria-label={target ? `เปลี่ยนประเภทปลายทาง (${target.name})` : 'เลือกประเภทปลายทาง'}
          sx={{
            mt: 1.5,
            p: 1.5,
            gap: 1.5,
            width: 1,
            minHeight: 76,
            textAlign: 'left',
            borderRadius: 1.5,
            justifyContent: 'flex-start',
            transition: theme.transitions.create(['background-color', 'border-color']),
            ...(target
              ? {
                  border: `2px solid ${theme.vars.palette.success.main}`,
                  bgcolor: varAlpha(theme.vars.palette.success.mainChannel, 0.08),
                }
              : {
                  border: `2px dashed ${varAlpha(theme.vars.palette.primary.mainChannel, 0.48)}`,
                  bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.04),
                  '&:hover': { bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.1) },
                }),
          }}
        >
          <Avatar
            variant="rounded"
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1.5,
              color: 'common.white',
              bgcolor: target ? 'success.main' : 'primary.main',
            }}
          >
            <Iconify
              icon={target ? 'solar:t-shirt-bold-duotone' : 'mingcute:add-line'}
              width={28}
            />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {target ? target.name : 'แตะเพื่อเลือกประเภทผ้า'}
            </Typography>
            <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
              {target
                ? target.group_name || 'ไม่ระบุหมวดหมู่'
                : 'หมวดหมู่เปลี่ยนตามประเภทใหม่อัตโนมัติ'}
            </Typography>
          </Box>
          {target ? (
            <Label color="success" sx={{ height: 32, px: 1.5 }}>
              เปลี่ยน
            </Label>
          ) : (
            <Iconify icon="eva:arrow-ios-forward-fill" sx={{ color: 'primary.main' }} />
          )}
        </ButtonBase>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

// ตัวเลขใหญ่ "จำนวนที่จะเปลี่ยน" + มาจากประเภทไหนบ้าง -> ไปประเภทไหน
export function ChangeCategorySummaryCard({ count, sources, target, continuous, fit }) {
  const theme = useTheme();
  const hiddenSources = sources.length - MAX_SUMMARY_SOURCES;

  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        color: 'common.white',
        ...bgGradient({
          color: `135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.primary.darker} 100%`,
        }),
        ...(fit ? { flex: '1 1 0', minHeight: 0 } : { flexGrow: 1 }),
      }}
    >
      <Iconify
        icon="solar:transfer-horizontal-bold-duotone"
        width={150}
        sx={{ position: 'absolute', right: -28, bottom: -34, opacity: 0.14 }}
      />
      {continuous && (
        <Label
          variant="filled"
          color="error"
          startIcon={<Iconify icon="svg-spinners:pulse-2" />}
          sx={{ position: 'absolute', top: 16, right: 16 }}
        >
          กำลังอ่าน
        </Label>
      )}
      <CardContent
        sx={{
          height: 1,
          display: 'flex',
          textAlign: 'center',
          alignItems: 'center',
          position: 'relative',
          flexDirection: 'column',
          justifyContent: 'center',
          ...(fit && { py: '12px !important' }),
        }}
      >
        <Typography sx={{ opacity: 0.9, fontWeight: 700, fontSize: 14 }}>
          จำนวนที่จะเปลี่ยนประเภท
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <Typography
            sx={{
              lineHeight: 1.05,
              fontWeight: 800,
              fontSize: fit ? 'clamp(48px, 10.5vh, 132px)' : { xs: 112, sm: 132 },
            }}
          >
            {formatCount(count)}
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9 }}>
            ชิ้น
          </Typography>
        </Stack>

        {sources.length > 0 && (
          <Stack
            direction="row"
            flexWrap="wrap"
            gap={0.75}
            justifyContent="center"
            sx={{ mt: 1, maxWidth: 1 }}
          >
            {sources.slice(0, MAX_SUMMARY_SOURCES).map((source) => (
              <Box
                key={source.categoryId}
                sx={{
                  px: 1.25,
                  py: 0.25,
                  maxWidth: 200,
                  borderRadius: 5,
                  typography: 'caption',
                  fontWeight: 600,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
                }}
              >
                {source.name} {formatCount(source.epcs.length)}
              </Box>
            ))}
            {hiddenSources > 0 && (
              <Box sx={{ py: 0.25, typography: 'caption', opacity: 0.9 }}>
                +{hiddenSources} ประเภท
              </Box>
            )}
          </Stack>
        )}
        {sources.length > 0 && target && (
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ mt: 1, maxWidth: 1, minWidth: 0 }}
          >
            <Iconify icon="eva:arrow-forward-fill" width={20} sx={{ flexShrink: 0 }} />
            <Typography variant="subtitle1" noWrap>
              {target.name}
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

// แถบผลการเปลี่ยนล่าสุด — ย้อนกลับได้ทันทีโดยไม่ขวางการสแกนชุดถัดไป
export function ChangeCategoryLastResult({ result, onRevert, onViewHistory, onDismiss }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={(theme) => ({
        pl: 2,
        pr: 1,
        py: 1,
        flexShrink: 0,
        borderRadius: 1.5,
        color: 'success.dark',
        bgcolor: varAlpha(theme.vars.palette.success.mainChannel, 0.12),
        [stylesMode.dark]: { color: 'success.light' },
      })}
    >
      <Iconify icon="solar:check-circle-bold-duotone" width={24} sx={{ flexShrink: 0 }} />
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
        เปลี่ยน {formatCount(result.applied.length)} ชิ้น เป็น {result.toCategory.name} แล้ว (#
        {result.batchId})
      </Typography>
      <Button
        size="small"
        color="inherit"
        startIcon={<Iconify icon="solar:restart-bold" />}
        onClick={() => onRevert(result.batchId)}
        sx={{ flexShrink: 0, minHeight: 40 }}
      >
        ย้อนกลับ
      </Button>
      <Button
        size="small"
        color="inherit"
        onClick={onViewHistory}
        sx={{ flexShrink: 0, minHeight: 40 }}
      >
        ดูประวัติ
      </Button>
      <IconButton
        size="small"
        color="inherit"
        aria-label="ปิดข้อความ"
        onClick={onDismiss}
        sx={{ flexShrink: 0 }}
      >
        <Iconify icon="mingcute:close-line" width={16} />
      </IconButton>
    </Stack>
  );
}
