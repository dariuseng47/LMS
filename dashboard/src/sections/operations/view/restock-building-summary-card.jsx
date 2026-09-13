import dayjs from 'dayjs';
import { useMemo, useState, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import NoSsr from '@mui/material/NoSsr';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate } from 'src/utils/format-time';
import { exportRowsToExcel } from 'src/utils/export-excel';
import { fNumber, fPercent } from 'src/utils/format-number';

import { useGetRestockReport } from 'src/actions/restockReport';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { SectionAvatar } from './restock-section-avatar';
import { RestockDateFilterCard } from './restock-date-filter-card';
import { RestockBuildingReportPDF } from '../restock-building-report-pdf';

// ----------------------------------------------------------------------

// จัดกลุ่มแถว building+category ที่ได้จาก server (flat list) ให้เป็น 1 ก้อนต่อตึก
function groupByBuilding(summaryByBuilding) {
  const map = new Map();
  summaryByBuilding.forEach((row) => {
    const key = row.buildingId ?? 'none';
    if (!map.has(key)) {
      map.set(key, { buildingId: row.buildingId, buildingName: row.buildingName, rows: [] });
    }
    map.get(key).rows.push(row);
  });
  return [...map.values()].sort((a, b) => a.buildingName.localeCompare(b.buildingName, 'th'));
}

function computeTotals(rows) {
  return rows.reduce(
    (acc, r) => ({
      parQty: acc.parQty + r.parQty,
      restockedQty: acc.restockedQty + r.restockedQty,
      onWardQty: acc.onWardQty + r.onWardQty,
      totalQty: acc.totalQty + r.totalQty,
    }),
    { parQty: 0, restockedQty: 0, onWardQty: 0, totalQty: 0 }
  );
}

// รายงานตามตึกเป็นรายงาน "ประจำเดือน" โดยธรรมชาติ (ดูตัวอย่างรายงานกระดาษเดิม) — ใช้ตัวกรองวันที่
// ของตัวเอง แยกจากตัวกรองบนสุดของหน้า (ซึ่งเน้นสรุปตามวอร์ด/ประวัติที่มักดูเป็นรายสัปดาห์)
export function RestockBuildingSummaryCard({ hospitalId }) {
  const [startDate, setStartDate] = useState(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState(dayjs());
  const [activePreset, setActivePreset] = useState('เดือนนี้');
  const [buildingId, setBuildingId] = useState('');

  const { range, summaryByBuilding, reportLoading } = useGetRestockReport(hospitalId, {
    startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined,
    endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined,
  });

  const handlePreset = (preset) => {
    const [from, to] = preset.getRange();
    setStartDate(from);
    setEndDate(to);
    setActivePreset(preset.label);
  };

  const buildings = useMemo(() => groupByBuilding(summaryByBuilding), [summaryByBuilding]);

  // เลือกตึกแรกให้อัตโนมัติตอนโหลดเสร็จ (หรือถ้าตึกที่เลือกไว้หายไปเพราะเปลี่ยนช่วงเวลา)
  useEffect(() => {
    if (buildings.length === 0) return;
    if (!buildings.some((b) => String(b.buildingId) === String(buildingId))) {
      setBuildingId(buildings[0].buildingId);
    }
  }, [buildings, buildingId]);

  const selectedBuilding = buildings.find((b) => String(b.buildingId) === String(buildingId)) ?? null;

  const totals = useMemo(
    () => (selectedBuilding ? computeTotals(selectedBuilding.rows) : null),
    [selectedBuilding]
  );
  const totalPct = totals && totals.parQty > 0 ? (totals.totalQty / totals.parQty) * 100 : null;

  const handleExportExcel = () => {
    if (!selectedBuilding || !totals) return;
    const rows = [
      ...selectedBuilding.rows.map((r) => ({
        categoryName: r.categoryName,
        parQty: r.parQty,
        restockedQty: r.restockedQty,
        onWardQty: r.onWardQty,
        totalQty: r.totalQty,
        pctLabel: '',
      })),
      {
        categoryName: 'รวมจำนวนทั้งหมด',
        parQty: totals.parQty,
        restockedQty: totals.restockedQty,
        onWardQty: totals.onWardQty,
        totalQty: totals.totalQty,
        pctLabel: totalPct === null ? '—' : `${totalPct.toFixed(1)}%`,
      },
    ];
    exportRowsToExcel({
      fileName: `เติมผ้า-${selectedBuilding.buildingName}-${startDate.format('YYYYMMDD')}-${endDate.format('YYYYMMDD')}`,
      sheetName: `ตึก${selectedBuilding.buildingName}`,
      title: `รายงานการเติมสต๊อก ตึก${selectedBuilding.buildingName}`,
      subtitle: range ? `ช่วงเวลา ${fDate(range.from)} — ${fDate(range.to)}` : '',
      columns: [
        { key: 'categoryName', label: 'รายการ', width: 160 },
        { key: 'parQty', label: 'จำนวนสต็อค (Par)' },
        { key: 'restockedQty', label: 'จำนวนที่เติม' },
        { key: 'onWardQty', label: 'จำนวนสต็อคบนวอร์ด' },
        { key: 'totalQty', label: 'รวมทั้งหมด' },
        { key: 'pctLabel', label: '% เทียบเป้าหมาย' },
      ],
      rows,
      totalRowIndexes: [rows.length - 1],
    });
  };

  return (
    <Stack spacing={3}>
      <RestockDateFilterCard
        startDate={startDate}
        endDate={endDate}
        activePreset={activePreset}
        onChangeStartDate={(v) => {
          setStartDate(v);
          setActivePreset(null);
        }}
        onChangeEndDate={(v) => {
          setEndDate(v);
          setActivePreset(null);
        }}
        onSelectPreset={handlePreset}
        description="สรุปตามตึกเป็นรายงานแยกช่วงเวลาของตัวเอง — ไม่ผูกกับตัวกรองของแท็บอื่น"
      />

      {reportLoading ? (
        <LoadingScreen />
      ) : buildings.length === 0 ? (
        <Card>
          <EmptyContent
            title="ไม่มีข้อมูลการเติมผ้าในช่วงเวลานี้"
            description="ลองเลือกช่วงเวลาอื่น หรือตรวจสอบว่าวอร์ดถูกจัดอยู่ใต้ตึก/ชั้นในโครงสร้างโรงพยาบาลแล้ว"
            sx={{ py: 8 }}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            avatar={<SectionAvatar icon="solar:buildings-2-bold-duotone" color="info" />}
            title={
              <TextField
                select
                size="small"
                label="เลือกตึก"
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                {buildings.map((b) => (
                  <MenuItem key={b.buildingId ?? 'none'} value={b.buildingId}>
                    {b.buildingName}
                  </MenuItem>
                ))}
              </TextField>
            }
            subheader={
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                สรุปการเติมผ้าทุกวอร์ดในตึก · {range ? `${fDate(range.from)} — ${fDate(range.to)}` : ''}
              </Typography>
            }
            action={
              selectedBuilding && (
                <Stack direction="row" spacing={1}>
                  <NoSsr>
                    <PDFDownloadLink
                      document={
                        <RestockBuildingReportPDF
                          buildingName={selectedBuilding.buildingName}
                          range={range}
                          rows={selectedBuilding.rows}
                          totals={totals}
                          totalPct={totalPct}
                        />
                      }
                      fileName={`เติมผ้า-${selectedBuilding.buildingName}-${startDate.format('YYYYMMDD')}-${endDate.format('YYYYMMDD')}.pdf`}
                      style={{ textDecoration: 'none' }}
                    >
                      {({ loading }) => (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={
                            loading ? (
                              <CircularProgress size={14} color="inherit" />
                            ) : (
                              <Iconify icon="solar:file-download-bold-duotone" />
                            )
                          }
                          disabled={loading}
                        >
                          Export PDF
                        </Button>
                      )}
                    </PDFDownloadLink>
                  </NoSsr>
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    startIcon={<Iconify icon="solar:file-text-bold-duotone" />}
                    onClick={handleExportExcel}
                  >
                    Export Excel
                  </Button>
                </Stack>
              )
            }
          />
          {selectedBuilding && totals && (
            <CardContent sx={{ pt: 0 }}>
              <Scrollbar sx={{ maxHeight: 480 }}>
                <TableContainer sx={{ minWidth: 640 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>รายการ</TableCell>
                        <TableCell align="right">จำนวนสต็อค (Par)</TableCell>
                        <TableCell align="right">จำนวนที่เติม</TableCell>
                        <TableCell align="right">จำนวนสต็อคบนวอร์ด</TableCell>
                        <TableCell align="right">รวมทั้งหมด</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedBuilding.rows.map((row) => (
                        <TableRow key={row.categoryId ?? row.categoryName} hover>
                          <TableCell>{row.categoryName}</TableCell>
                          <TableCell align="right">{fNumber(row.parQty)}</TableCell>
                          <TableCell align="right">{fNumber(row.restockedQty)}</TableCell>
                          <TableCell align="right">{fNumber(row.onWardQty)}</TableCell>
                          <TableCell align="right">
                            <Typography variant="subtitle2">{fNumber(row.totalQty)}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: 'background.neutral' }}>
                        <TableCell>
                          <Typography variant="subtitle2">รวมจำนวนทั้งหมด</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2">{fNumber(totals.parQty)}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2">{fNumber(totals.restockedQty)}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2">{fNumber(totals.onWardQty)}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2">{fNumber(totals.totalQty)}</Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            คิดเป็นเปอร์เซ็นต์ (รวมทั้งหมด / จำนวนสต็อค)
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {totalPct === null ? (
                            '—'
                          ) : (
                            <Chip
                              size="small"
                              variant="soft"
                              color={totalPct >= 100 ? 'success' : totalPct >= 70 ? 'warning' : 'error'}
                              label={fPercent(totalPct)}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Scrollbar>
            </CardContent>
          )}
        </Card>
      )}
    </Stack>
  );
}
