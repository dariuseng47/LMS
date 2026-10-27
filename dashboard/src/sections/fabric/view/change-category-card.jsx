'use client';

import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import CardContent from '@mui/material/CardContent';
import ToggleButton from '@mui/material/ToggleButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { changeFabricCategory, useGetFabricItems, fabricCategoryLabel } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { STATUS_LABEL } from '../fabric-constants';

// ----------------------------------------------------------------------

const MAX_PER_BATCH = 500;

function parseEpcCodes(raw) {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

function StepHeader({ step, title, subtitle }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        sx={{
          width: 28,
          height: 28,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          typography: 'subtitle2',
          color: 'primary.contrastText',
          bgcolor: 'primary.main',
        }}
      >
        {step}
      </Box>
      <Box>
        <Typography variant="subtitle1">{title}</Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

// ตัวเลือกผ้าจากรายการ — กรองตามประเภทปัจจุบัน/ล็อต/รหัส EPC แล้วติ๊กเลือกรายชิ้น หรือเลือกทั้งหมดตามตัวกรอง
function ItemPicker({ hospitalId, categories, lots, selected, onChange }) {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { fabricItems, fabricItemsLoading } = useGetFabricItems({
    hospitalId,
    categoryId: categoryFilter,
    lotId: lotFilter,
  });

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return fabricItems.filter(
      (item) =>
        item.status !== 'DECOMMISSIONED' && (!keyword || item.epc_code.toLowerCase().includes(keyword))
    );
  }, [fabricItems, search]);

  const pageRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.epc_code));
  const someSelected = rows.some((r) => selected.has(r.epc_code));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) rows.forEach((r) => next.delete(r.epc_code));
    else rows.forEach((r) => next.add(r.epc_code));
    onChange(next);
  };

  const toggleOne = (epc) => {
    const next = new Set(selected);
    if (next.has(epc)) next.delete(epc);
    else next.add(epc);
    onChange(next);
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <TextField
          size="small"
          fullWidth
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder="ค้นหารหัส EPC"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          label="ประเภทปัจจุบัน"
          value={categoryFilter}
          onChange={(event) => {
            setCategoryFilter(event.target.value);
            setPage(0);
          }}
          sx={{ minWidth: { md: 220 } }}
        >
          <MenuItem value="">ทุกประเภท</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {fabricCategoryLabel(c)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="ล็อต"
          value={lotFilter}
          onChange={(event) => {
            setLotFilter(event.target.value);
            setPage(0);
          }}
          sx={{ minWidth: { md: 160 } }}
        >
          <MenuItem value="">ทุกล็อต</MenuItem>
          {lots.map((lot) => (
            <MenuItem key={lot.id} value={lot.id}>
              {lot.lot_code}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {fabricItemsLoading ? (
        <LoadingScreen sx={{ height: 200 }} />
      ) : rows.length === 0 ? (
        <EmptyContent title="ไม่พบผ้าตามตัวกรอง" sx={{ py: 5 }} />
      ) : (
        <>
          <TableContainer sx={{ border: (t) => `1px solid ${t.vars.palette.divider}`, borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox checked={allSelected} indeterminate={!allSelected && someSelected} onChange={toggleAll} />
                  </TableCell>
                  <TableCell>รหัส EPC</TableCell>
                  <TableCell>ประเภทปัจจุบัน</TableCell>
                  <TableCell>สถานะ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((item) => {
                  const category = categoryById.get(item.fabric_category_id);
                  return (
                    <TableRow
                      key={item.id}
                      hover
                      selected={selected.has(item.epc_code)}
                      onClick={() => toggleOne(item.epc_code)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={selected.has(item.epc_code)} />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{item.epc_code}</TableCell>
                      <TableCell>{category ? fabricCategoryLabel(category) : '—'}</TableCell>
                      <TableCell>{STATUS_LABEL[item.status] ?? item.status}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              ติ๊กหัวตารางเพื่อเลือกทั้งหมดตามตัวกรอง ({rows.length} ชิ้น)
            </Typography>
            <TablePagination
              component="div"
              count={rows.length}
              page={page}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[10, 25, 50]}
              labelRowsPerPage="แถวต่อหน้า"
              onPageChange={(_, next) => setPage(next)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setPage(0);
              }}
            />
          </Stack>
        </>
      )}
    </Stack>
  );
}

export function ChangeCategoryCard({
  hospitalId,
  groups,
  categories,
  lots,
  onChanged,
  onViewHistory,
  onRevertRequest,
}) {
  const [mode, setMode] = useState('epc'); // 'epc' วาง/สแกนรหัส | 'list' เลือกจากรายการ
  const [epcRaw, setEpcRaw] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [groupId, setGroupId] = useState('all');
  const [targetCategory, setTargetCategory] = useState(null);
  const [reason, setReason] = useState('');

  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState(null);
  const [applying, setApplying] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const epcCodes = useMemo(
    () => (mode === 'epc' ? parseEpcCodes(epcRaw) : [...selected]),
    [mode, epcRaw, selected]
  );

  const categoryOptions = useMemo(
    () => (groupId === 'all' ? categories : categories.filter((c) => Number(c.group_id) === Number(groupId))),
    [categories, groupId]
  );

  const overLimit = epcCodes.length > MAX_PER_BATCH;
  const canCheck = !!hospitalId && !!targetCategory && epcCodes.length > 0 && !overLimit;

  const payload = useCallback(
    (confirm) => ({
      epcCodes,
      toCategoryId: targetCategory?.id,
      reason: reason.trim() || undefined,
      confirm,
    }),
    [epcCodes, targetCategory, reason]
  );

  const handleCheck = async () => {
    setChecking(true);
    try {
      setPreview(await changeFabricCategory(payload(false), hospitalId));
    } catch (error) {
      toast.error(error?.message || 'ตรวจสอบไม่สำเร็จ');
    } finally {
      setChecking(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const result = await changeFabricCategory(payload(true), hospitalId);
      toast.success(`เปลี่ยนประเภทผ้าสำเร็จ ${result.applied.length} ชิ้น`);
      setLastResult(result);
      setPreview(null);
      setEpcRaw('');
      setSelected(new Set());
      setReason('');
      onChanged();
    } catch (error) {
      toast.error(error?.message || 'เปลี่ยนประเภทผ้าไม่สำเร็จ');
    } finally {
      setApplying(false);
    }
  };

  const readyCount = preview?.ready?.length ?? 0;

  return (
    <Stack spacing={3}>
      {lastResult && (
        <Alert
          severity="success"
          onClose={() => setLastResult(null)}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                color="inherit"
                startIcon={<Iconify icon="solar:restart-bold" />}
                onClick={() => onRevertRequest(lastResult.batchId)}
              >
                ย้อนกลับทันที
              </Button>
              <Button size="small" color="inherit" onClick={onViewHistory}>
                ดูประวัติ
              </Button>
            </Stack>
          }
        >
          เปลี่ยนผ้า {lastResult.applied.length} ชิ้น ไปเป็น &quot;{lastResult.toCategory.name}&quot; แล้ว (รายการ #
          {lastResult.batchId}) — บันทึกเป็นเวอร์ชันและ log เรียบร้อย
        </Alert>
      )}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
        {/* ขั้น 1: เลือกผ้า */}
        <Card sx={{ flex: 1, width: 1, minWidth: 0 }}>
          <CardHeader
            title={<StepHeader step={1} title="เลือกผ้าที่จะเปลี่ยน" subtitle="รายชิ้นหรือเป็นชุด สูงสุด 500 ชิ้นต่อครั้ง" />}
            action={
              <ToggleButtonGroup
                size="small"
                exclusive
                value={mode}
                onChange={(_, value) => value && setMode(value)}
              >
                <ToggleButton value="epc">วาง / สแกนรหัส EPC</ToggleButton>
                <ToggleButton value="list">เลือกจากรายการ</ToggleButton>
              </ToggleButtonGroup>
            }
          />
          <CardContent>
            {!hospitalId ? (
              <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 6 }} />
            ) : mode === 'epc' ? (
              <TextField
                fullWidth
                multiline
                rows={9}
                value={epcRaw}
                onChange={(event) => setEpcRaw(event.target.value)}
                label="รหัส EPC"
                placeholder={'วางได้หลายรายการ (ขึ้นบรรทัดใหม่ / คอมมา / เว้นวรรค) เช่น\nE28069150000402EBE98B21C\nE28069150000402EBED6660D\n\nหรือสแกนด้วยเครื่องอ่านที่ต่อกับคอมพิวเตอร์ลงในช่องนี้ได้เลย'}
                helperText="ชิ้นเดียวหรือหลายชิ้นใช้ช่องเดียวกัน — ตรวจสอบผลก่อนยืนยันทุกครั้ง"
              />
            ) : (
              <ItemPicker
                hospitalId={hospitalId}
                categories={categories}
                lots={lots}
                selected={selected}
                onChange={setSelected}
              />
            )}
          </CardContent>
        </Card>

        {/* ขั้น 2-3: ปลายทาง + ยืนยัน */}
        <Card sx={{ width: { xs: 1, lg: 400 }, flexShrink: 0, position: { lg: 'sticky' }, top: { lg: 88 } }}>
          <CardHeader title={<StepHeader step={2} title="เลือกประเภทปลายทาง" subtitle="หมวดหมู่ผ้าเปลี่ยนตามประเภทใหม่อัตโนมัติ" />} />
          <CardContent>
            <Stack spacing={2.5}>
              <TextField
                select
                size="small"
                label="หมวดหมู่ผ้า (ตัวกรอง)"
                value={groupId}
                onChange={(event) => {
                  setGroupId(event.target.value);
                  setTargetCategory(null);
                }}
                disabled={!hospitalId}
              >
                <MenuItem value="all">ทุกหมวดหมู่</MenuItem>
                {groups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.name}
                  </MenuItem>
                ))}
              </TextField>

              <Autocomplete
                size="small"
                options={categoryOptions}
                value={targetCategory}
                onChange={(_, value) => setTargetCategory(value)}
                getOptionLabel={(option) => fabricCategoryLabel(option)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                noOptionsText="ไม่พบประเภทผ้า"
                disabled={!hospitalId}
                renderInput={(params) => (
                  <TextField {...params} label="ประเภทผ้าปลายทาง (พิมพ์ค้นหาได้)" placeholder="เลือกประเภทผ้า" />
                )}
              />

              <Divider />
              <StepHeader step={3} title="ตรวจสอบและยืนยัน" />

              <TextField
                size="small"
                label="เหตุผลการเปลี่ยน (ไม่บังคับ)"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                inputProps={{ maxLength: 500 }}
                multiline
                minRows={2}
              />

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  variant="soft"
                  color={overLimit ? 'error' : epcCodes.length > 0 ? 'info' : 'default'}
                  label={`เลือกไว้ ${epcCodes.length} ชิ้น`}
                />
                {targetCategory && (
                  <Chip size="small" variant="soft" color="success" label={`→ ${targetCategory.name}`} />
                )}
              </Stack>
              {overLimit && (
                <Typography variant="caption" sx={{ color: 'error.main' }}>
                  เกินจำนวนสูงสุดต่อครั้ง ({MAX_PER_BATCH} ชิ้น)
                </Typography>
              )}

              <LoadingButton
                fullWidth
                size="large"
                variant="contained"
                loading={checking}
                disabled={!canCheck}
                onClick={handleCheck}
                startIcon={<Iconify icon="solar:transfer-horizontal-bold-duotone" />}
              >
                ตรวจสอบก่อนเปลี่ยน
              </LoadingButton>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={!!preview} onClose={applying ? undefined : () => setPreview(null)} fullWidth maxWidth="md">
        <DialogTitle>ยืนยันการเปลี่ยนประเภทผ้า</DialogTitle>
        <DialogContent dividers>
          {preview && (
            <Stack spacing={2.5}>
              <Typography variant="body1">
                เปลี่ยนเป็นประเภท: <b>{fabricCategoryLabel({ name: preview.toCategory.name, group_name: preview.toCategory.groupName })}</b>
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip color={readyCount ? 'success' : 'default'} variant="soft" label={`เปลี่ยนได้ ${readyCount} ชิ้น`} />
                {preview.same.length > 0 && (
                  <Chip variant="soft" label={`อยู่ประเภทนี้แล้ว ${preview.same.length} ชิ้น (ข้าม)`} />
                )}
                {preview.blocked.length > 0 && (
                  <Chip color="error" variant="soft" label={`เปลี่ยนไม่ได้ (จำหน่ายออกแล้ว) ${preview.blocked.length} ชิ้น`} />
                )}
                {preview.notFound.length > 0 && (
                  <Chip color="warning" variant="soft" label={`ไม่พบในระบบ ${preview.notFound.length} ชิ้น`} />
                )}
              </Stack>

              {preview.notFound.length > 0 && (
                <Alert severity="warning">
                  ไม่พบในระบบ: {preview.notFound.slice(0, 20).join(', ')}
                  {preview.notFound.length > 20 ? ` … (+${preview.notFound.length - 20})` : ''}
                </Alert>
              )}

              {readyCount > 0 ? (
                <TableContainer sx={{ maxHeight: 340, border: (t) => `1px solid ${t.vars.palette.divider}`, borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>รหัส EPC</TableCell>
                        <TableCell>จาก (ปัจจุบัน)</TableCell>
                        <TableCell>เป็น</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.ready.map((row) => (
                        <TableRow key={row.itemId}>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{row.epcCode}</TableCell>
                          <TableCell>
                            {row.fromGroupName ? `${row.fromGroupName} › ` : ''}
                            {row.fromCategoryName}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{preview.toCategory.name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">ไม่มีผ้าที่เปลี่ยนประเภทได้ในรายการนี้</Alert>
              )}

              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                การเปลี่ยนนี้จะถูกบันทึกเป็นเวอร์ชันพร้อม log และย้อนกลับได้จากแท็บ &quot;ประวัติ & ย้อนกลับ&quot;
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setPreview(null)} disabled={applying}>
            แก้ไขรายการ
          </Button>
          <LoadingButton variant="contained" loading={applying} disabled={readyCount === 0} onClick={handleApply}>
            ยืนยันเปลี่ยน {readyCount > 0 ? `(${readyCount} ชิ้น)` : ''}
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
