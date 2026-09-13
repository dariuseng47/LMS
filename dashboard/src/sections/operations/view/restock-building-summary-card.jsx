import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import NoSsr from '@mui/material/NoSsr';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import Autocomplete from '@mui/material/Autocomplete';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate } from 'src/utils/format-time';
import { fNumber, fPercent } from 'src/utils/format-number';
import { sanitizeFileName, exportSheetsToExcel } from 'src/utils/export-excel';

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

// จัดกลุ่ม summaryByWard (มี buildingId ติดมาจาก server แล้ว) เป็น Map<buildingId, wardGroup[]> —
// ใช้ตอน export Excel ที่ต้องมีชีตย่อยระดับวอร์ดของตึกที่เลือกด้วย
function groupWardsByBuilding(summaryByWard) {
  const byBuilding = new Map();
  summaryByWard.forEach((row) => {
    const bKey = row.buildingId ?? 'none';
    if (!byBuilding.has(bKey)) byBuilding.set(bKey, new Map());
    const wardMap = byBuilding.get(bKey);
    const wKey = row.wardName;
    if (!wardMap.has(wKey)) wardMap.set(wKey, { wardName: wKey, total: 0, categories: [] });
    const group = wardMap.get(wKey);
    group.total += row.count;
    group.categories.push(row);
  });
  const result = new Map();
  byBuilding.forEach((wardMap, bKey) => {
    result.set(bKey, [...wardMap.values()].sort((a, b) => b.total - a.total));
  });
  return result;
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

// รวมยอดข้ามตึก แยกตามชนิดผ้า — ใช้เป็นชีตสรุปท้ายสุดตอน export Excel เมื่อเลือกหลายตึก/ทั้งหมด
function computeCombinedByCategory(displayedBuildings) {
  const map = new Map();
  displayedBuildings.forEach((b) => {
    b.rows.forEach((r) => {
      if (!map.has(r.categoryName)) {
        map.set(r.categoryName, {
          categoryName: r.categoryName,
          parQty: 0,
          restockedQty: 0,
          onWardQty: 0,
          totalQty: 0,
        });
      }
      const entry = map.get(r.categoryName);
      entry.parQty += r.parQty;
      entry.restockedQty += r.restockedQty;
      entry.onWardQty += r.onWardQty;
      entry.totalQty += r.totalQty;
    });
  });
  return [...map.values()].sort((a, b) => b.totalQty - a.totalQty);
}

function BuildingTable({ building, range }) {
  const totals = useMemo(() => computeTotals(building.rows), [building.rows]);
  const totalPct = totals.parQty > 0 ? (totals.totalQty / totals.parQty) * 100 : null;

  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:buildings-2-bold-duotone" color="info" />}
        title={`ตึก${building.buildingName}`}
        subheader={range ? `สรุปการเติมผ้าทุกวอร์ดในตึก · ${fDate(range.from)} — ${fDate(range.to)}` : ''}
      />
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
                {building.rows.map((row) => (
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
    </Card>
  );
}

// รายงานตามตึกเป็นรายงาน "ประจำเดือน" โดยธรรมชาติ (ดูตัวอย่างรายงานกระดาษเดิม) — ใช้ตัวกรองวันที่
// ของตัวเอง แยกจากตัวกรองบนสุดของหน้า (ซึ่งเน้นสรุปตามวอร์ด/ประวัติที่มักดูเป็นรายสัปดาห์)
// เลือกได้ทั้งหมด (ไม่เลือกอะไรเลย) ตึกเดียว หรือหลายตึกพร้อมกัน — export Excel จะแยกชีตตึก + ชีตวอร์ด
// ของทุกตึกที่เลือก ปิดท้ายด้วยชีตสรุปรวมข้ามตึกแยกตามชนิดผ้า
export function RestockBuildingSummaryCard({ hospitalId, hospitalName }) {
  const [startDate, setStartDate] = useState(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState(dayjs());
  const [activePreset, setActivePreset] = useState('เดือนนี้');
  const [selectedBuildingIds, setSelectedBuildingIds] = useState([]); // ว่าง = ทั้งหมด

  const { range, summaryByBuilding, summaryByWard, reportLoading } = useGetRestockReport(hospitalId, {
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
  const wardsByBuildingId = useMemo(() => groupWardsByBuilding(summaryByWard), [summaryByWard]);

  const selectedBuildingOptions = useMemo(
    () => buildings.filter((b) => selectedBuildingIds.includes(b.buildingId)),
    [buildings, selectedBuildingIds]
  );

  const displayedBuildings = selectedBuildingIds.length === 0 ? buildings : selectedBuildingOptions;

  const rangeLabel = range ? `${fDate(range.from)} — ${fDate(range.to)}` : '';

  // ใส่ชื่อโรงพยาบาลนำหน้าชื่อไฟล์เสมอ (ถ้ามี) กันสับสนเวลามีรายงานจากหลายโรงพยาบาลปนกัน — ต่อท้ายด้วย
  // ชื่อตึกถ้าเลือกตึกเดียว หรือ "ทุกตึก"/"หลายตึก" ถ้าเลือกมากกว่านั้น
  const scopeLabel =
    displayedBuildings.length === 1
      ? displayedBuildings[0].buildingName
      : selectedBuildingIds.length === 0
        ? 'ทุกตึก'
        : 'หลายตึก';
  const exportFileBase = `เติมผ้า-${hospitalName ? `${sanitizeFileName(hospitalName)}-` : ''}${sanitizeFileName(scopeLabel)}-${startDate.format('YYYYMMDD')}-${endDate.format('YYYYMMDD')}`;

  const handleExportExcel = () => {
    if (displayedBuildings.length === 0) return;
    const sheets = [];

    displayedBuildings.forEach((building) => {
      const totals = computeTotals(building.rows);
      const totalPct = totals.parQty > 0 ? (totals.totalQty / totals.parQty) * 100 : null;
      const buildingRows = [
        ...building.rows.map((r) => ({
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
      sheets.push({
        sheetName: `ตึก${building.buildingName}`,
        title: `รายงานการเติมสต๊อก ตึก${building.buildingName}`,
        subtitle: [hospitalName, rangeLabel ? `ช่วงเวลา ${rangeLabel}` : ''].filter(Boolean).join(' · '),
        columns: [
          { key: 'categoryName', label: 'รายการ', width: 160 },
          { key: 'parQty', label: 'จำนวนสต็อค (Par)' },
          { key: 'restockedQty', label: 'จำนวนที่เติม' },
          { key: 'onWardQty', label: 'จำนวนสต็อคบนวอร์ด' },
          { key: 'totalQty', label: 'รวมทั้งหมด' },
          { key: 'pctLabel', label: '% เทียบเป้าหมาย' },
        ],
        rows: buildingRows,
        totalRowIndexes: [buildingRows.length - 1],
      });

      const wardGroups = wardsByBuildingId.get(building.buildingId ?? 'none') ?? [];
      wardGroups.forEach((group) => {
        const wardRows = [
          ...group.categories.map((c) => ({
            categoryName: c.categoryName,
            count: c.count,
            transferCount: c.transferCount,
          })),
          {
            categoryName: 'รวม',
            count: group.total,
            transferCount: group.categories.reduce((sum, c) => sum + c.transferCount, 0),
          },
        ];
        sheets.push({
          sheetName: group.wardName,
          title: `สรุปการเติมผ้า — ${group.wardName} (ตึก${building.buildingName})`,
          subtitle: [hospitalName, rangeLabel ? `ช่วงเวลา ${rangeLabel}` : ''].filter(Boolean).join(' · '),
          columns: [
            { key: 'categoryName', label: 'หมวดหมู่ผ้า', width: 160 },
            { key: 'count', label: 'จำนวนครั้งที่เติม' },
            { key: 'transferCount', label: 'โอนข้ามตู้' },
          ],
          rows: wardRows,
          totalRowIndexes: [wardRows.length - 1],
        });
      });
    });

    // ชีตสุดท้าย: สรุปรวมทุกตึกที่เลือก แยกตามชนิดผ้า + แถวรวมผ้าทั้งหมด
    const combined = computeCombinedByCategory(displayedBuildings);
    const grandTotals = computeTotals(combined);
    const grandPct = grandTotals.parQty > 0 ? (grandTotals.totalQty / grandTotals.parQty) * 100 : null;
    const summaryRows = [
      ...combined.map((r) => ({
        categoryName: r.categoryName,
        parQty: r.parQty,
        restockedQty: r.restockedQty,
        onWardQty: r.onWardQty,
        totalQty: r.totalQty,
        pctLabel: '',
      })),
      {
        categoryName: 'รวมผ้าทั้งหมด',
        parQty: grandTotals.parQty,
        restockedQty: grandTotals.restockedQty,
        onWardQty: grandTotals.onWardQty,
        totalQty: grandTotals.totalQty,
        pctLabel: grandPct === null ? '—' : `${grandPct.toFixed(1)}%`,
      },
    ];
    sheets.push({
      sheetName: 'สรุปรวมทุกตึก',
      title: `สรุปรวม${scopeLabel} — แยกตามชนิดผ้า`,
      subtitle: [hospitalName, rangeLabel ? `ช่วงเวลา ${rangeLabel}` : ''].filter(Boolean).join(' · '),
      columns: [
        { key: 'categoryName', label: 'รายการ', width: 160 },
        { key: 'parQty', label: 'จำนวนสต็อค (Par)' },
        { key: 'restockedQty', label: 'จำนวนที่เติม' },
        { key: 'onWardQty', label: 'จำนวนสต็อคบนวอร์ด' },
        { key: 'totalQty', label: 'รวมทั้งหมด' },
        { key: 'pctLabel', label: '% เทียบเป้าหมาย' },
      ],
      rows: summaryRows,
      totalRowIndexes: [summaryRows.length - 1],
    });

    exportSheetsToExcel({ fileName: exportFileBase, sheets });
  };

  const pdfBuildings = useMemo(
    () =>
      displayedBuildings.map((building) => {
        const totals = computeTotals(building.rows);
        const totalPct = totals.parQty > 0 ? (totals.totalQty / totals.parQty) * 100 : null;
        return { ...building, totals, totalPct };
      }),
    [displayedBuildings]
  );

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

      <Card>
        <CardHeader
          avatar={<SectionAvatar icon="solar:buildings-2-bold-duotone" color="info" />}
          title="สรุปการเติมผ้าแยกตามตึก"
          subheader={rangeLabel}
          action={
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Autocomplete
                multiple
                size="small"
                options={buildings}
                value={selectedBuildingOptions}
                onChange={(event, newValue) => setSelectedBuildingIds(newValue.map((v) => v.buildingId))}
                getOptionLabel={(option) => option.buildingName}
                isOptionEqualToValue={(option, value) => option.buildingId === value.buildingId}
                sx={{ minWidth: 280 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="เลือกตึก"
                    placeholder={selectedBuildingIds.length === 0 ? 'ทั้งหมด (ทุกตึก)' : ''}
                  />
                )}
              />
              {displayedBuildings.length > 0 && (
                <>
                  <NoSsr>
                    <PDFDownloadLink
                      document={
                        <RestockBuildingReportPDF
                          hospitalName={hospitalName}
                          range={range}
                          buildings={pdfBuildings}
                        />
                      }
                      fileName={`${exportFileBase}.pdf`}
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
                </>
              )}
            </Stack>
          }
        />
      </Card>

      {reportLoading ? (
        <LoadingScreen />
      ) : displayedBuildings.length === 0 ? (
        <Card>
          <EmptyContent
            title="ไม่มีข้อมูลการเติมผ้าในช่วงเวลานี้"
            description="ลองเลือกช่วงเวลาหรือตึกอื่น หรือตรวจสอบว่าวอร์ดถูกจัดอยู่ใต้ตึก/ชั้นในโครงสร้างโรงพยาบาลแล้ว"
            sx={{ py: 8 }}
          />
        </Card>
      ) : (
        displayedBuildings.map((building) => (
          <BuildingTable key={building.buildingId ?? 'none'} building={building} range={range} />
        ))
      )}
    </Stack>
  );
}
