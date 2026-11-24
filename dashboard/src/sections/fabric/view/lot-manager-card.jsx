'use client';

import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

import { useClientPagination } from 'src/hooks/use-client-pagination';

import { sanitizeFileName, exportRowsToExcel } from 'src/utils/export-excel';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { TablePaginationBar } from 'src/components/table';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { SectionAvatar } from 'src/sections/operations/view/restock-section-avatar';

import { lotProgress } from '../register-target';
import { FabricListReportPDF } from '../fabric-report-pdf';
import { FabricExportToolbar } from '../fabric-export-toolbar';
import { fabricPdfRange, fabricRangeLabel, filterRowsByDateRange } from '../fabric-export-utils';

// ----------------------------------------------------------------------

// width เป็นตัวเลข (หน่วยเดียวกับ ss:Width ของ Excel) ไม่ใช่ '%' — ดู fabric-report-pdf.jsx
const EXPORT_COLUMNS = [
  { key: 'lotCode', label: 'รหัสล็อต', width: 180 },
  { key: 'category', label: 'ประเภท', width: 180 },
  { key: 'quantity', label: 'จำนวน', width: 120, align: 'right' },
  { key: 'registered', label: 'ลงทะเบียนแล้ว', width: 130, align: 'right' },
  { key: 'maxWashCycles', label: 'รอบซักไม่เกิน', width: 140, align: 'right' },
  { key: 'purchasedAt', label: 'วันที่จัดซื้อ', width: 180 },
  { key: 'createdBy', label: 'เพิ่มโดย', width: 200 },
];

function LotProgressCell({ lot }) {
  const progress = lotProgress(lot);
  if (!progress) return lot.quantity;

  return (
    <Stack spacing={0.75} sx={{ minWidth: 160 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography variant="body2">
          <b>{progress.registered.toLocaleString('th-TH')}</b> /{' '}
          {progress.quantity.toLocaleString('th-TH')} ชิ้น
        </Typography>
        {progress.isFull && <Label color="success">ครบแล้ว</Label>}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={progress.percent}
        color={progress.isFull ? 'success' : 'primary'}
        sx={{ height: 6, borderRadius: 1 }}
      />
    </Stack>
  );
}

// แท็บ "ตั้งค่าล็อต" — canEdit = เพิ่มล็อต/ลงทะเบียนผ้าเข้าล็อตได้ | onRegisterLot = ไปแท็บสแกนพร้อมเลือกล็อตนี้
export function LotManagerCard({
  hospitalId,
  hospitalName,
  lots,
  lotsLoading,
  canEdit,
  onWantNewLot,
  onRegisterLot,
}) {
  const [search, setSearch] = useState('');
  const [purchasedFrom, setPurchasedFrom] = useState(null);
  const [purchasedTo, setPurchasedTo] = useState(null);
  const [activeDatePreset, setActiveDatePreset] = useState('ทั้งหมด');

  const handleDatePreset = (preset) => {
    const [from, to] = preset.getRange();
    setPurchasedFrom(from);
    setPurchasedTo(to);
    setActiveDatePreset(preset.label);
  };

  // กรองตามวันที่จัดซื้อ (purchased_at) — ล็อตที่ยังไม่ระบุวันที่จัดซื้อ ('0000-00-00'/ว่าง) จะถูก
  // ตัดออกเมื่อเลือกช่วงเวลาใดช่วงเวลาหนึ่ง (ดู filterRowsByDateRange)
  const filteredLots = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return filterRowsByDateRange(lots, 'purchased_at', purchasedFrom, purchasedTo).filter(
      (lot) =>
        !keyword ||
        [lot.lot_code, lot.category_name, lot.group_name].some((text) =>
          (text || '').toLowerCase().includes(keyword)
        )
    );
  }, [lots, purchasedFrom, purchasedTo, search]);
  const { pageRows, pagination } = useClientPagination(filteredLots, {
    resetKey: `${purchasedFrom}|${purchasedTo}|${search}`,
  });

  const exportRows = useMemo(
    () =>
      filteredLots.map((lot) => ({
        lotCode: lot.lot_code,
        category: lot.category_name ?? '—',
        quantity: lot.quantity,
        registered: lotProgress(lot)?.registered ?? '—',
        maxWashCycles: lot.max_wash_cycles ? `${lot.max_wash_cycles} ครั้ง` : '—',
        purchasedAt:
          lot.purchased_at && lot.purchased_at !== '0000-00-00'
            ? new Date(lot.purchased_at).toLocaleDateString('th-TH')
            : '—',
        createdBy: lot.created_by_name ?? '—',
      })),
    [filteredLots]
  );

  const rangeLabel = fabricRangeLabel(purchasedFrom, purchasedTo);
  const pdfRange = fabricPdfRange(purchasedFrom, purchasedTo);
  const rangeSuffix =
    purchasedFrom || purchasedTo
      ? `-${dayjs(purchasedFrom ?? purchasedTo).format('YYYYMMDD')}-${dayjs(purchasedTo ?? purchasedFrom).format('YYYYMMDD')}`
      : '';
  const exportFileBase = `ล็อตผ้า${hospitalName ? `-${sanitizeFileName(hospitalName)}` : ''}${rangeSuffix}`;

  const handleExportExcel = () => {
    exportRowsToExcel({
      fileName: exportFileBase,
      sheetName: 'ล็อตผ้า',
      title: 'รายงานล็อตผ้าทั้งหมด',
      subtitle: [hospitalName, `ช่วงเวลา ${rangeLabel}`].filter(Boolean).join(' · '),
      columns: EXPORT_COLUMNS,
      rows: exportRows,
    });
  };

  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:box-bold-duotone" color="primary" />}
        title="ตั้งค่าล็อต"
        subheader="ล็อตที่จัดซื้อ/นำเข้า — เพิ่มล็อตไว้ก่อน แล้วกด “สแกนเข้าล็อต” ตอนติด RFID tag เสร็จ"
        action={
          canEdit && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={onWantNewLot}
              sx={{ minHeight: 44 }}
            >
              เพิ่มล็อต
            </Button>
          )
        }
      />
      <CardContent>
        {lots.length > 0 && (
          <Stack spacing={2} sx={{ mb: 2.5 }}>
            <FabricExportToolbar
              dateFilterProps={{
                startDate: purchasedFrom,
                endDate: purchasedTo,
                activePreset: activeDatePreset,
                onChangeStartDate: (v) => {
                  setPurchasedFrom(v);
                  setActiveDatePreset(null);
                },
                onChangeEndDate: (v) => {
                  setPurchasedTo(v);
                  setActiveDatePreset(null);
                },
                onSelectPreset: handleDatePreset,
                dateLabel: 'วันที่จัดซื้อ',
              }}
              pdfDocument={
                <FabricListReportPDF
                  title="รายงานล็อตผ้าทั้งหมด"
                  hospitalName={hospitalName}
                  range={pdfRange}
                  columns={EXPORT_COLUMNS}
                  rows={exportRows}
                />
              }
              pdfFileName={`${exportFileBase}.pdf`}
              onExportExcel={handleExportExcel}
            />
            <TextField
              fullWidth
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหารหัสล็อต / ประเภทผ้า / หมวดหมู่"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
            <Divider />
          </Stack>
        )}

        {lotsLoading ? (
          <LoadingScreen sx={{ height: 200 }} />
        ) : lots.length === 0 ? (
          <EmptyContent
            title="ยังไม่มีล็อตผ้าในระบบ"
            description="เริ่มต้นด้วยการเพิ่มล็อตแรกตอนจัดซื้อ/นำเข้าผ้า"
            sx={{ py: 8 }}
          />
        ) : filteredLots.length === 0 ? (
          <EmptyContent title="ไม่พบล็อตตามตัวกรองที่เลือก" sx={{ py: 8 }} />
        ) : (
          <>
            <Scrollbar>
              <TableContainer sx={{ minWidth: 960 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>รหัสล็อต</TableCell>
                      <TableCell>ประเภท</TableCell>
                      <TableCell>ลงทะเบียนแล้ว / จำนวน</TableCell>
                      <TableCell align="right">รอบซักไม่เกิน</TableCell>
                      <TableCell>วันที่จัดซื้อ</TableCell>
                      <TableCell>เพิ่มโดย</TableCell>
                      {canEdit && <TableCell align="right" />}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageRows.map((lot) => (
                      <TableRow key={lot.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{lot.lot_code}</TableCell>
                        <TableCell>
                          {lot.category_name ? (
                            <Chip
                              size="small"
                              variant="soft"
                              label={[lot.group_name, lot.category_name].filter(Boolean).join(' › ')}
                            />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <LotProgressCell lot={lot} />
                        </TableCell>
                        <TableCell align="right">
                          {lot.max_wash_cycles ? `${lot.max_wash_cycles} ครั้ง` : '—'}
                        </TableCell>
                        <TableCell>
                          {lot.purchased_at && lot.purchased_at !== '0000-00-00'
                            ? new Date(lot.purchased_at).toLocaleDateString('th-TH')
                            : '—'}
                        </TableCell>
                        <TableCell>{lot.created_by_name ?? '—'}</TableCell>
                        {canEdit && (
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onRegisterLot(lot)}
                              startIcon={<Iconify icon="solar:radar-2-bold-duotone" />}
                              sx={{ whiteSpace: 'nowrap' }}
                            >
                              สแกนเข้าล็อต
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
            <TablePaginationBar {...pagination} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
