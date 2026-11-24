'use client';

import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
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

import { FabricListReportPDF } from '../fabric-report-pdf';
import { FabricExportToolbar } from '../fabric-export-toolbar';
import { lotLines, lotProgress, lineProgress } from '../register-target';
import { fabricPdfRange, fabricRangeLabel, filterRowsByDateRange } from '../fabric-export-utils';

// ----------------------------------------------------------------------

// width เป็นตัวเลข (หน่วยเดียวกับ ss:Width ของ Excel) ไม่ใช่ '%' — ดู fabric-report-pdf.jsx
const EXPORT_COLUMNS = [
  { key: 'lotCode', label: 'รหัสล็อต', width: 180 },
  { key: 'category', label: 'ประเภท', width: 190 },
  { key: 'purchasedAt', label: 'วันที่จัดซื้อ', width: 120 },
  { key: 'createdBy', label: 'เพิ่มโดย', width: 170 },
  { key: 'maxWashCycles', label: 'รอบซักไม่เกิน', width: 130, align: 'right' },
  { key: 'quantity', label: 'จำนวนสั่งซื้อ', width: 120, align: 'right' },
  { key: 'registered', label: 'ลงทะเบียนแล้ว', width: 130, align: 'right' },
];

const LINE_LIMIT = 4;

// ประเภทในล็อต + ยอดลงทะเบียนของแต่ละประเภท
function LotLinesCell({ lot }) {
  const [expanded, setExpanded] = useState(false);
  const lines = lotLines(lot);
  if (lines.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.disabled' }}>
        ยังไม่มีประเภทผ้า
      </Typography>
    );
  }

  return (
    <Stack spacing={1.25} sx={{ minWidth: 260 }}>
      {(expanded ? lines : lines.slice(0, LINE_LIMIT)).map((line) => {
        const { registered, quantity, percent, isFull } = lineProgress(line);
        return (
          <Box key={line.category_id}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {line.category_name ?? 'ไม่ระบุประเภท'}
              </Typography>
              {quantity === null && (
                <Tooltip title="ไม่มีจำนวนสั่งซื้อ — ประเภทนี้เพิ่มเข้าล็อตจากผ้าที่ลงทะเบียน">
                  <span>
                    <Label color="info">เพิ่มอัตโนมัติ</Label>
                  </span>
                </Tooltip>
              )}
              {isFull && <Label color="success">ครบแล้ว</Label>}
              <Typography variant="caption" sx={{ flexShrink: 0, color: 'text.secondary' }}>
                <b>{registered.toLocaleString('th-TH')}</b>
                {quantity !== null && `/${quantity.toLocaleString('th-TH')}`} ชิ้น
              </Typography>
            </Stack>
            {quantity !== null && (
              <LinearProgress
                variant="determinate"
                value={percent}
                color={isFull ? 'success' : 'primary'}
                sx={{ mt: 0.5, height: 5, borderRadius: 1 }}
              />
            )}
          </Box>
        );
      })}
      {lines.length > LINE_LIMIT && (
        <Button
          size="small"
          color="inherit"
          onClick={() => setExpanded((prev) => !prev)}
          sx={{ alignSelf: 'flex-start' }}
        >
          {expanded ? 'ย่อ' : `ดูทั้งหมด ${lines.length} ประเภท`}
        </Button>
      )}
    </Stack>
  );
}

function LotTotal({ lot }) {
  const { registered, quantity } = lotProgress(lot);
  return (
    <>
      <Typography variant="subtitle2" component="span">
        {registered.toLocaleString('th-TH')}
      </Typography>
      {quantity !== null && `/${quantity.toLocaleString('th-TH')}`} ชิ้น
    </>
  );
}

function formatLotDate(value) {
  return value && value !== '0000-00-00' ? new Date(value).toLocaleDateString('th-TH') : '—';
}

// แท็บ "ตั้งค่าล็อต" — canEdit = เพิ่ม/แก้ไขล็อต ลงทะเบียนผ้าเข้าล็อตได้ | onRegisterLot = ไปแท็บสแกนพร้อมเลือกล็อตนี้
export function LotManagerCard({
  hospitalId,
  hospitalName,
  lots,
  lotsLoading,
  canEdit,
  onWantNewLot,
  onEditLot,
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
        [
          lot.lot_code,
          ...lotLines(lot).flatMap((line) => [line.category_name, line.group_name]),
        ].some((text) => (text || '').toLowerCase().includes(keyword))
    );
  }, [lots, purchasedFrom, purchasedTo, search]);
  const { pageRows, pagination } = useClientPagination(filteredLots, {
    resetKey: `${purchasedFrom}|${purchasedTo}|${search}`,
  });

  // 1 แถว = 1 ประเภทในล็อต (ล็อตที่ยังไม่มีประเภท = 1 แถว)
  const exportRows = useMemo(
    () =>
      filteredLots.flatMap((lot) => {
        const common = {
          lotCode: lot.lot_code,
          maxWashCycles: lot.max_wash_cycles ? `${lot.max_wash_cycles} ครั้ง` : '—',
          purchasedAt: formatLotDate(lot.purchased_at),
          createdBy: lot.created_by_name ?? '—',
        };
        const lines = lotLines(lot);
        if (lines.length === 0) {
          return [{ ...common, category: '—', quantity: lot.quantity, registered: 0 }];
        }
        return lines.map((line) => ({
          ...common,
          category: line.category_name ?? 'ไม่ระบุประเภท',
          quantity: line.quantity ?? '—',
          registered: line.registered_count,
        }));
      }),
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
        subheader="1 ล็อตใส่ได้หลายประเภทผ้า — เพิ่มล็อตไว้ก่อน แล้วกด “สแกนเข้าล็อต” ตอนติด RFID tag เสร็จ"
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
                      <TableCell>ล็อต</TableCell>
                      <TableCell>ประเภทผ้าในล็อต (ลงทะเบียนแล้ว / สั่งซื้อ)</TableCell>
                      <TableCell align="right">รวม</TableCell>
                      <TableCell align="right">รอบซักไม่เกิน</TableCell>
                      <TableCell>เพิ่มโดย</TableCell>
                      {canEdit && <TableCell align="right" />}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageRows.map((lot) => (
                      <TableRow key={lot.id} hover sx={{ '& td': { verticalAlign: 'top' } }}>
                        <TableCell>
                          <Typography variant="subtitle2">{lot.lot_code}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            จัดซื้อ {formatLotDate(lot.purchased_at)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <LotLinesCell lot={lot} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <LotTotal lot={lot} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {lot.max_wash_cycles ? `${lot.max_wash_cycles} ครั้ง` : 'ตามประเภท'}
                        </TableCell>
                        <TableCell>{lot.created_by_name ?? '—'}</TableCell>
                        {canEdit && (
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onRegisterLot(lot)}
                              startIcon={<Iconify icon="solar:radar-2-bold-duotone" />}
                            >
                              สแกนเข้าล็อต
                            </Button>
                            <Tooltip title="แก้ไขล็อต">
                              <IconButton
                                aria-label={`แก้ไขล็อต ${lot.lot_code}`}
                                onClick={() => onEditLot(lot)}
                                sx={{ ml: 0.5 }}
                              >
                                <Iconify icon="solar:pen-2-bold-duotone" width={18} />
                              </IconButton>
                            </Tooltip>
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
