'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
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
import InputAdornment from '@mui/material/InputAdornment';
import TablePagination from '@mui/material/TablePagination';

import { useDebounce } from 'src/hooks/use-debounce';

import {
  fabricCategoryLabel,
  fetchAllFabricItems,
  useGetFabricItemsPage,
} from 'src/actions/fabric';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { STATUS_COLOR, STATUS_LABEL } from '../fabric-constants';

// ----------------------------------------------------------------------

const isChangeable = (item) => item.status !== 'DECOMMISSIONED';

// เลือกผ้าจากคลัง (ไม่ต้องมีเครื่องอ่าน) — โหลดทีละหน้าจาก server กรองตามประเภทปัจจุบัน/ล็อต/รหัส EPC แล้วติ๊กรายชิ้น
// ทั้งหน้า หรือทั้งหมดตามตัวกรอง (ไม่เกิน maxPick) แล้วเพิ่มเข้ารายการเดียวกับที่สแกน
// listedEpcs = Set รหัสที่อยู่ในรายการแล้ว (ติ๊กไว้ให้ แก้ไม่ได้ที่นี่)
function ItemPickerContent({ hospitalId, categories, lots, listedEpcs, maxPick, onClose, onAdd }) {
  const [categoryId, setCategoryId] = useState('');
  const [lotId, setLotId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [picked, setPicked] = useState(() => new Set());
  const [selectingAll, setSelectingAll] = useState(false);

  const debouncedSearch = useDebounce(search.trim(), 300);
  useEffect(() => {
    setPage(0);
  }, [categoryId, lotId, debouncedSearch, rowsPerPage]);

  const filters = { hospitalId, categoryId, lotId, search: debouncedSearch };
  const { fabricItems, fabricItemsTotal, fabricItemsLoading, fabricItemsError } =
    useGetFabricItemsPage(filters, { page, rowsPerPage });

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const pickableRows = fabricItems.filter(
    (item) => isChangeable(item) && !listedEpcs.has(item.epc_code)
  );
  const pagePicked =
    pickableRows.length > 0 && pickableRows.every((item) => picked.has(item.epc_code));
  const pagePartlyPicked = pickableRows.some((item) => picked.has(item.epc_code));

  const toggle = (epc) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(epc)) next.add(epc);
      return next;
    });

  const togglePage = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      pickableRows.forEach((item) => {
        if (pagePicked) next.delete(item.epc_code);
        else next.add(item.epc_code);
      });
      return next;
    });

  const handlePickAll = async () => {
    setSelectingAll(true);
    try {
      const items = await fetchAllFabricItems({ ...filters, limit: maxPick });
      setPicked((prev) => {
        const next = new Set(prev);
        items.forEach((item) => {
          if (isChangeable(item) && !listedEpcs.has(item.epc_code)) next.add(item.epc_code);
        });
        return next;
      });
    } catch (error) {
      toast.error(error?.message || 'โหลดรายการผ้าไม่สำเร็จ');
    } finally {
      setSelectingAll(false);
    }
  };

  const tooManyToPickAll = fabricItemsTotal > maxPick;

  const renderTable = () => {
    if (fabricItemsLoading) return <LoadingScreen sx={{ height: 280 }} />;
    if (fabricItemsError) {
      return (
        <EmptyContent
          title="โหลดรายการผ้าไม่สำเร็จ"
          description={fabricItemsError?.message}
          sx={{ py: 5 }}
        />
      );
    }
    if (fabricItems.length === 0) {
      return <EmptyContent title="ไม่พบผ้าตามตัวกรอง" sx={{ py: 5 }} />;
    }
    return (
      <>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={1}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            พบ {fabricItemsTotal.toLocaleString('th-TH')} ชิ้น
          </Typography>
          <LoadingButton
            size="small"
            variant="soft"
            color="primary"
            loading={selectingAll}
            disabled={tooManyToPickAll}
            onClick={handlePickAll}
            startIcon={<Iconify icon="solar:check-read-bold" />}
            sx={{ minHeight: 36 }}
          >
            {tooManyToPickAll
              ? `เลือกทั้งหมดได้ไม่เกิน ${maxPick} ชิ้น — กรองให้แคบลง`
              : 'เลือกทั้งหมดตามตัวกรอง'}
          </LoadingButton>
        </Stack>

        <TableContainer
          sx={{ borderRadius: 1, border: (t) => `1px solid ${t.vars.palette.divider}` }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={pagePicked}
                    indeterminate={!pagePicked && pagePartlyPicked}
                    disabled={pickableRows.length === 0}
                    onChange={togglePage}
                    inputProps={{ 'aria-label': 'เลือกทั้งหน้า' }}
                  />
                </TableCell>
                <TableCell>รหัส EPC</TableCell>
                <TableCell>ประเภทปัจจุบัน</TableCell>
                <TableCell>สถานะ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fabricItems.map((item) => {
                const category = categoryById.get(item.fabric_category_id);
                const listed = listedEpcs.has(item.epc_code);
                const locked = listed || !isChangeable(item);
                const checked = listed || picked.has(item.epc_code);
                return (
                  <TableRow
                    key={item.id}
                    hover={!locked}
                    selected={!locked && checked}
                    onClick={locked ? undefined : () => toggle(item.epc_code)}
                    sx={{ cursor: locked ? 'default' : 'pointer', opacity: locked ? 0.56 : 1 }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={checked} disabled={locked} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{item.epc_code}</TableCell>
                    <TableCell>{category ? fabricCategoryLabel(category) : '—'}</TableCell>
                    <TableCell>
                      {listed ? (
                        <Label color="info">อยู่ในรายการแล้ว</Label>
                      ) : (
                        <Label color={STATUS_COLOR[item.status] || 'default'}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </Label>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={fabricItemsTotal}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage="แถวต่อหน้า"
          onPageChange={(_, next) => setPage(next)}
          onRowsPerPageChange={(event) => setRowsPerPage(Number(event.target.value))}
        />
      </>
    );
  };

  return (
    <>
      <DialogTitle sx={{ pb: 2 }}>เลือกผ้าจากคลัง</DialogTitle>

      <DialogContent dividers sx={{ py: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              fullWidth
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
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
              value={lotId}
              onChange={(event) => setLotId(event.target.value)}
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

          {renderTable()}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
          เลือกไว้ {picked.size.toLocaleString('th-TH')} ชิ้น
        </Typography>
        {picked.size > 0 && (
          <Button size="small" color="inherit" onClick={() => setPicked(new Set())}>
            ล้าง
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button color="inherit" onClick={onClose} sx={{ minHeight: 44 }}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={picked.size === 0}
          onClick={() => onAdd([...picked])}
          sx={{ minHeight: 44, px: 2.5 }}
        >
          เพิ่มเข้ารายการ
        </Button>
      </DialogActions>
    </>
  );
}

// เนื้อหาอยู่ใน component แยกที่ถูกถอดเมื่อปิด (Dialog ไม่ keepMounted) — เปิดใหม่เริ่มว่างเสมอ และไม่โหลดผ้าก่อนเปิด
export function ChangeCategoryItemPickerDialog({ open, onClose, ...other }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <ItemPickerContent onClose={onClose} {...other} />
    </Dialog>
  );
}
