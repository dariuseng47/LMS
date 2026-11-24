'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Collapse from '@mui/material/Collapse';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { varAlpha } from 'src/theme/styles';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const fromLabel = (row) =>
  row.fromGroupName ? `${row.fromGroupName} › ${row.fromCategoryName}` : row.fromCategoryName;

// ยืนยันการเปลี่ยนประเภท — preview = ผลตรวจจาก server (confirm=false) สรุป "จากประเภทไหน กี่ชิ้น -> ประเภทปลายทาง"
// ก่อน แล้วค่อยกางดูรายชิ้น | onConfirm(reason)
export function ChangeCategoryConfirmDialog({ preview, applying, onClose, onConfirm }) {
  // เก็บผลล่าสุดไว้แม้ปิดแล้ว — ระหว่างแอนิเมชันปิด เนื้อหาเดิมยังอยู่ ไม่กระพริบเป็นว่าง
  const [shown, setShown] = useState(preview);
  const [reason, setReason] = useState('');
  const [showItems, setShowItems] = useState(false);

  useEffect(() => {
    if (!preview) return;
    setShown(preview);
    setReason('');
    setShowItems(false);
  }, [preview]);

  const sources = useMemo(() => {
    const map = new Map();
    (shown?.ready ?? []).forEach((row) => {
      const current = map.get(row.fromCategoryId);
      if (current) current.count += 1;
      else map.set(row.fromCategoryId, { label: fromLabel(row), count: 1 });
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [shown]);

  const readyCount = shown?.ready.length ?? 0;

  return (
    <Dialog open={!!preview} onClose={applying ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 2 }}>ยืนยันการเปลี่ยนประเภทผ้า</DialogTitle>

      <DialogContent dividers sx={{ py: 2.5 }}>
        {shown && (
          <Stack spacing={2.5}>
            {readyCount === 0 ? (
              <Alert severity="info">ไม่มีผ้าที่เปลี่ยนประเภทได้ในรายการนี้</Alert>
            ) : (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems="stretch"
                spacing={{ xs: 1, sm: 2 }}
              >
                <Stack
                  spacing={1}
                  sx={{
                    p: 2,
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 2,
                    bgcolor: 'background.neutral',
                  }}
                >
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                    จาก
                  </Typography>
                  <Stack spacing={0.75} sx={{ maxHeight: 180, overflowY: 'auto' }}>
                    {sources.map((source) => (
                      <Stack
                        key={source.label}
                        direction="row"
                        spacing={1}
                        justifyContent="space-between"
                      >
                        <Typography variant="body2" sx={{ minWidth: 0 }}>
                          {source.label}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ flexShrink: 0 }}>
                          {source.count.toLocaleString('th-TH')} ชิ้น
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>

                <Stack alignItems="center" justifyContent="center" sx={{ flexShrink: 0 }}>
                  <Iconify
                    icon="eva:arrow-forward-fill"
                    width={28}
                    sx={{
                      color: 'primary.main',
                      transform: { xs: 'rotate(90deg)', sm: 'none' },
                    }}
                  />
                </Stack>

                <Stack
                  spacing={1}
                  sx={(theme) => ({
                    p: 2,
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 2,
                    bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
                    border: `1px solid ${varAlpha(theme.vars.palette.primary.mainChannel, 0.32)}`,
                  })}
                >
                  <Typography variant="overline" sx={{ color: 'primary.main' }}>
                    เป็น
                  </Typography>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Avatar
                      variant="rounded"
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                      }}
                    >
                      <Iconify icon="solar:t-shirt-bold-duotone" width={26} />
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
                        {shown.toCategory.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {shown.toCategory.groupName || 'ไม่ระบุหมวดหมู่'}
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Stack>
            )}

            {(shown.same.length > 0 || shown.blocked.length > 0) && (
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {shown.same.length > 0 && (
                  <Chip
                    size="small"
                    variant="soft"
                    label={`อยู่ประเภทนี้แล้ว ${shown.same.length} ชิ้น (ข้าม)`}
                  />
                )}
                {shown.blocked.length > 0 && (
                  <Chip
                    size="small"
                    color="error"
                    variant="soft"
                    label={`แทงชำรุดแล้ว ${shown.blocked.length} ชิ้น (ข้าม)`}
                  />
                )}
              </Stack>
            )}

            {shown.notFound.length > 0 && (
              <Alert severity="warning">
                ไม่พบในระบบ {shown.notFound.length} ชิ้น (ข้าม):{' '}
                {shown.notFound.slice(0, 10).join(', ')}
                {shown.notFound.length > 10 ? ` … (+${shown.notFound.length - 10})` : ''}
              </Alert>
            )}

            {readyCount > 0 && (
              <div>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setShowItems((prev) => !prev)}
                  endIcon={
                    <Iconify
                      icon={showItems ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
                    />
                  }
                  sx={{ minHeight: 36 }}
                >
                  {showItems ? 'ซ่อนรายชิ้น' : `ดูรายชิ้นทั้งหมด (${readyCount})`}
                </Button>
                <Collapse in={showItems} mountOnEnter unmountOnExit>
                  <TableContainer
                    sx={{
                      mt: 1,
                      maxHeight: 260,
                      borderRadius: 1,
                      border: (t) => `1px solid ${t.vars.palette.divider}`,
                    }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>รหัส EPC</TableCell>
                          <TableCell>ประเภทปัจจุบัน</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {shown.ready.map((row) => (
                          <TableRow key={row.itemId}>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{row.epcCode}</TableCell>
                            <TableCell>{fromLabel(row)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </div>
            )}

            {readyCount > 0 && (
              <TextField
                fullWidth
                multiline
                minRows={2}
                value={reason}
                disabled={applying}
                onChange={(event) => setReason(event.target.value)}
                label="เหตุผลการเปลี่ยน (ไม่บังคับ)"
                placeholder="เช่น ลงทะเบียนผิดประเภท"
                inputProps={{ maxLength: 500 }}
                helperText="บันทึกเป็นประวัติ ย้อนกลับได้จากแท็บ “ประวัติ & ย้อนกลับ”"
              />
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={applying} sx={{ minHeight: 48, px: 2 }}>
          แก้ไขรายการ
        </Button>
        <LoadingButton
          variant="contained"
          color="primary"
          size="large"
          loading={applying}
          disabled={readyCount === 0}
          onClick={() => onConfirm(reason.trim())}
          startIcon={<Iconify icon="solar:check-read-bold-duotone" />}
          sx={{ minHeight: 48, px: 3 }}
        >
          ยืนยันเปลี่ยน{readyCount > 0 ? ` ${readyCount.toLocaleString('th-TH')} ชิ้น` : ''}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
