import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import Autocomplete from '@mui/material/Autocomplete';
import TableContainer from '@mui/material/TableContainer';

import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useClientPagination } from 'src/hooks/use-client-pagination';

import { fDate, fDateTime } from 'src/utils/format-time';
import { sanitizeFileName, exportSheetsToExcel } from 'src/utils/export-excel';

import { useGetDepartments } from 'src/actions/departments';
import { useGetRewashAnalysis } from 'src/actions/restockReport';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { Scrollbar } from 'src/components/scrollbar';
import { Chart, useChart } from 'src/components/chart';
import { TablePaginationBar } from 'src/components/table';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { SectionAvatar } from './restock-section-avatar';
import { RestockDateFilterCard } from './restock-date-filter-card';
import { getWardOptions, getBuildingOptions } from './restock-fill-history-utils';
import { STATUS_LABEL, STATUS_COLOR, formatRewashReason } from '../../fabric/fabric-constants';
import {
  formatHours,
  closeStateLabel,
  sourceStatusColor,
  SOURCE_STATUS_HINT,
  buildRewashExcelSheets,
} from './restock-rewash-utils';

// ----------------------------------------------------------------------

// แท็บ "ประวัติผ้าส่งซักใหม่" — ผ้าที่ถูกเปลี่ยนสถานะเป็น "ส่งซักใหม่" (handheld › เปลี่ยนสถานะผ้า หรือ popup
// หน้าคลังผ้า) มาจากแผนกไหน / เจอตอนสถานะไหนมากที่สุด + ประเภทผ้า เหตุผล ชิ้นที่ถูกส่งซ้ำบ่อย และสถานะการซัก
// ข้อมูลจาก rewash_records (snapshot แผนก/สถานะ ณ ตอนส่ง) ผ่าน GET /restock-report/rewash-analysis
export function RestockRewashHistoryCard({ hospitalId, hospitalName }) {
  const theme = useTheme();
  const { mode } = theme.palette;

  const [startDate, setStartDate] = useState(dayjs().subtract(29, 'day'));
  const [endDate, setEndDate] = useState(dayjs());
  const [activePreset, setActivePreset] = useState('30 วันล่าสุด');
  const [building, setBuilding] = useState(null);
  const [selectedWards, setSelectedWards] = useState([]);

  const { departments } = useGetDepartments(hospitalId);
  const buildingOptions = useMemo(() => getBuildingOptions(departments), [departments]);
  const wardOptions = useMemo(
    () => getWardOptions(departments, building?.id ?? null),
    [departments, building]
  );

  const {
    range,
    summary,
    byStatus,
    byWard,
    byCategory,
    byReason,
    trend,
    repeatItems,
    recent,
    recentTruncated,
    rewashLoading,
    refreshRewash,
  } = useGetRewashAnalysis(hospitalId, {
    startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined,
    endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined,
    buildingId: building?.id,
    wardIds: selectedWards.map((w) => w.id),
  });

  // มีคนส่งซักใหม่ / รับผ้าหลังซัก จากเครื่องอื่น -> รีเฟรชทันที
  useSocketEvent('scan:status-change', refreshRewash);
  useSocketEvent('scan:wash-receive', refreshRewash);

  const handlePreset = (preset) => {
    const [from, to] = preset.getRange();
    setStartDate(from);
    setEndDate(to);
    setActivePreset(preset.label);
  };

  const scopeLabel =
    selectedWards.length > 0
      ? selectedWards.map((w) => w.name).join(', ')
      : building
        ? `ทุกวอร์ด (ตึก${building.name})`
        : 'ทุกแผนก';
  const rangeLabel = range ? `${fDate(range.from)} — ${fDate(range.to)}` : '';
  const scoped = !!building || selectedWards.length > 0;

  const handleExportExcel = () => {
    if (summary.total === 0) return;
    exportSheetsToExcel({
      fileName: `ผ้าส่งซักใหม่-${hospitalName ? `${sanitizeFileName(hospitalName)}-` : ''}${sanitizeFileName(scopeLabel)}-${startDate.format('YYYYMMDD')}-${endDate.format('YYYYMMDD')}`,
      sheets: buildRewashExcelSheets({
        byWard,
        byStatus,
        recent,
        hospitalName,
        scopeLabel,
        rangeLabel,
      }),
    });
  };

  const wardRows = byWard.filter((w) => w.wardId != null);
  const noWardRow = byWard.find((w) => w.wardId == null);
  const maxWard = wardRows[0]?.count ?? 0;

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
        description='เก็บจากการเปลี่ยนสถานะผ้าเป็น "ส่งซักใหม่" บนแอป handheld / หน้าคลังผ้า — บันทึกแผนกและสถานะ ณ ตอนที่ส่ง'
      />

      <Card sx={{ px: 3, py: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Autocomplete
            size="small"
            options={buildingOptions}
            value={building}
            onChange={(event, v) => {
              setBuilding(v);
              setSelectedWards([]);
            }}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            sx={{ minWidth: 180 }}
            renderInput={(params) => (
              <TextField {...params} label="เลือกตึก" placeholder="ทั้งหมด (ทุกตึก)" />
            )}
          />
          <Autocomplete
            multiple
            size="small"
            options={wardOptions}
            value={selectedWards}
            onChange={(event, v) => setSelectedWards(v)}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            sx={{ minWidth: 240, flex: '1 1 240px' }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="เลือกแผนก/วอร์ด"
                placeholder={selectedWards.length === 0 ? 'ทั้งหมด' : ''}
              />
            )}
          />
          <Tooltip title="รีเฟรช">
            <IconButton onClick={() => refreshRewash()}>
              <Iconify icon="solar:refresh-bold-duotone" width={20} />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<Iconify icon="solar:file-text-bold-duotone" />}
            onClick={handleExportExcel}
            disabled={summary.total === 0}
          >
            Export Excel
          </Button>
        </Stack>
        {scoped ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            เลือกตึก/วอร์ดแล้ว — นับเฉพาะผ้าที่ส่งซักใหม่จากตู้ของวอร์ดในขอบเขตนี้
            (ไม่รวมผ้าที่เจอในสต๊อกกลาง/หลังซัก)
          </Typography>
        ) : null}
      </Card>

      {rewashLoading ? (
        <LoadingScreen sx={{ py: 8 }} />
      ) : summary.total === 0 ? (
        <Card>
          <EmptyContent
            title="ยังไม่มีผ้าส่งซักใหม่ในช่วงนี้"
            description='ส่งซักใหม่ได้จากแอป handheld › เปลี่ยนสถานะผ้า › เลือก "ส่งซักใหม่" — ลองขยายช่วงวันที่'
            sx={{ py: 8 }}
          />
        </Card>
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <StatCard
                icon="solar:refresh-circle-bold-duotone"
                title={`ส่งซักใหม่ (ครั้ง) · ${summary.uniqueItems} ชิ้น`}
                value={summary.total}
                color="error"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard
                icon="solar:repeat-bold-duotone"
                title="ผ้าที่ถูกส่งซ้ำ ≥ 2 ครั้ง"
                value={summary.repeatItemCount}
                color="warning"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard
                icon="solar:hourglass-bold-duotone"
                title="ยังรอซัก (ตอนนี้)"
                value={summary.openCount}
                color="info"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard
                icon="solar:washing-machine-bold-duotone"
                title={`ซักแล้ว ${summary.washedCount} · ไม่ผ่านการซัก ${summary.bypassedCount}`}
                value={formatHours(summary.avgTurnaroundHours)}
                color="primary"
              />
            </Grid>
          </Grid>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: -2 }}>
            การ์ดขวาสุด = เวลาเฉลี่ยตั้งแต่ส่งซักใหม่จนผ่านการรับผ้าหลังซัก ·
            &quot;ไม่ผ่านการซัก&quot; = ผ้าออกจากสถานะส่งซักใหม่ทางอื่น
            (เปลี่ยนสถานะเอง/สแกนเข้าสต๊อคตรง ๆ)
          </Typography>

          <Grid container spacing={3} alignItems="stretch">
            <Grid item xs={12} md={5}>
              <Card sx={{ height: 1 }}>
                <CardHeader
                  avatar={<SectionAvatar icon="solar:routing-2-bold-duotone" color="warning" />}
                  title="มาจากสถานะไหนมากที่สุด"
                  subheader="สถานะของผ้าตอนที่ถูกส่งซักใหม่ = จุดที่เจอปัญหา"
                />
                <Stack spacing={2} sx={{ p: 3 }}>
                  {byStatus.map((s) => (
                    <RankedBar
                      key={s.status}
                      label={STATUS_LABEL[s.status] ?? s.status}
                      hint={SOURCE_STATUS_HINT[s.status]}
                      count={s.count}
                      pct={s.pct}
                      ratio={s.count / (byStatus[0]?.count || 1)}
                      color={sourceStatusColor(s.status, mode, theme.palette.grey[500])}
                    />
                  ))}
                </Stack>
              </Card>
            </Grid>
            <Grid item xs={12} md={7}>
              <Card sx={{ height: 1 }}>
                <CardHeader
                  avatar={<SectionAvatar icon="solar:hospital-bold-duotone" color="error" />}
                  title="แผนกที่ส่งซักใหม่มากที่สุด"
                  subheader={
                    noWardRow
                      ? `ไม่นับผ้าที่ไม่ได้มาจากวอร์ด ${noWardRow.count} ครั้ง (เจอในสต๊อกกลาง/หลังซัก)`
                      : 'นับจากตู้แผนกที่ผ้าอยู่ตอนส่ง'
                  }
                />
                {wardRows.length === 0 ? (
                  <EmptyContent title="ไม่มีผ้าส่งซักใหม่ที่มาจากวอร์ด" sx={{ py: 6 }} />
                ) : (
                  <Stack spacing={2} sx={{ p: 3 }}>
                    {wardRows.slice(0, 8).map((w, idx) => (
                      <RankedBar
                        key={w.wardId}
                        rank={idx + 1}
                        label={w.wardName}
                        hint={[
                          w.buildingName !== '-' ? `ตึก${w.buildingName}` : null,
                          w.topCategory ? `พบบ่อย: ${w.topCategory.name}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        count={w.count}
                        pct={w.pct}
                        ratio={w.count / (maxWard || 1)}
                        color={theme.palette.error.main}
                      />
                    ))}
                    {wardRows.length > 8 ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        …อีก {wardRows.length - 8} แผนก (ดูตารางด้านล่าง)
                      </Typography>
                    ) : null}
                  </Stack>
                )}
              </Card>
            </Grid>
          </Grid>

          <RewashTrendCard trend={trend} mode={mode} />

          <Grid container spacing={3} alignItems="stretch">
            <Grid item xs={12} md={6}>
              <Card sx={{ height: 1 }}>
                <CardHeader
                  avatar={<SectionAvatar icon="solar:t-shirt-bold-duotone" color="info" />}
                  title="ประเภทผ้าที่ส่งซักใหม่บ่อย"
                />
                <Stack spacing={2} sx={{ p: 3 }}>
                  {byCategory.slice(0, 8).map((c) => (
                    <RankedBar
                      key={c.categoryId}
                      label={c.name}
                      count={c.count}
                      pct={c.pct}
                      ratio={c.count / (byCategory[0]?.count || 1)}
                      color={theme.palette.info.dark}
                    />
                  ))}
                </Stack>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: 1 }}>
                <CardHeader
                  avatar={
                    <SectionAvatar icon="solar:chat-square-like-bold-duotone" color="secondary" />
                  }
                  title="เหตุผลที่ส่งซักใหม่"
                  subheader="เลือกได้ตอนส่ง (ไม่บังคับ)"
                />
                <Stack spacing={2} sx={{ p: 3 }}>
                  {byReason.map((r) => (
                    <RankedBar
                      key={r.reasonCode ?? 'none'}
                      label={formatRewashReason(r.reasonCode)}
                      count={r.count}
                      pct={r.pct}
                      ratio={r.count / (byReason[0]?.count || 1)}
                      color={r.reasonCode ? theme.palette.secondary.main : theme.palette.grey[500]}
                    />
                  ))}
                </Stack>
              </Card>
            </Grid>
          </Grid>

          <WardTableCard byWard={byWard} mode={mode} />

          {repeatItems.length > 0 ? <RepeatItemsCard repeatItems={repeatItems} /> : null}

          <RecentRecordsCard recent={recent} truncated={recentTruncated} total={summary.total} />
        </>
      )}
    </Stack>
  );
}

// ----------------------------------------------------------------------

// แถบอันดับแนวนอน: ชื่อ + จำนวน/เปอร์เซ็นต์ (ตัวอักษรใช้สีข้อความปกติ สีแท่งบอกตัวตน/ขนาด)
function RankedBar({ rank, label, hint, count, pct, ratio, color }) {
  return (
    <Box>
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.75 }}>
        {rank ? (
          <Typography variant="caption" sx={{ color: 'text.disabled', width: 18 }}>
            {rank}.
          </Typography>
        ) : null}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {label}
          </Typography>
          {hint ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="div">
              {hint}
            </Typography>
          ) : null}
        </Box>
        <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
          {count}
          <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.75 }}>
            {pct}%
          </Typography>
        </Typography>
      </Stack>
      <Tooltip title={`${label}: ${count} ครั้ง (${pct}%)`} placement="top">
        <Box sx={{ height: 8, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
          <Box
            sx={{
              height: 1,
              width: `${Math.max(ratio * 100, 2)}%`,
              borderRadius: 1,
              bgcolor: color,
            }}
          />
        </Box>
      </Tooltip>
    </Box>
  );
}

function RewashTrendCard({ trend, mode }) {
  const theme = useTheme();
  const series = trend.series.map((s) => ({
    name: STATUS_LABEL[s.status] ?? s.status,
    data: s.data,
  }));
  const colors = trend.series.map((s) =>
    sourceStatusColor(s.status, mode, theme.palette.grey[500])
  );

  const chartOptions = useChart({
    chart: { stacked: true },
    colors,
    // เว้นช่อง 2px สีพื้นการ์ดระหว่างชั้นที่ stack กัน
    stroke: { show: true, width: 2, colors: [theme.palette.background.paper] },
    legend: { show: true, position: 'top', horizontalAlign: 'right' },
    xaxis: {
      categories: trend.days.map((d) =>
        trend.granularity === 'week' ? `สัปดาห์ ${fDate(d, 'D MMM')}` : fDate(d, 'D MMM')
      ),
    },
    yaxis: { title: { text: 'ครั้ง' }, forceNiceScale: true },
    plotOptions: {
      bar: {
        columnWidth: '55%',
        borderRadius: 4,
        borderRadiusApplication: 'end',
        borderRadiusWhenStacked: 'last',
      },
    },
    tooltip: { y: { formatter: (v) => `${v} ครั้ง` } },
  });

  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:chart-2-bold-duotone" color="info" />}
        title={
          trend.granularity === 'week'
            ? 'แนวโน้มผ้าส่งซักใหม่ (รายสัปดาห์)'
            : 'แนวโน้มผ้าส่งซักใหม่ (รายวัน)'
        }
        subheader="แยกสีตามสถานะก่อนส่ง — ดูว่าช่วงไหนเจอผ้าสกปรกที่จุดไหนมาก"
      />
      <Box sx={{ p: 2.5 }}>
        <Chart type="bar" series={series} options={chartOptions} height={320} />
      </Box>
    </Card>
  );
}

function WardTableCard({ byWard, mode }) {
  const theme = useTheme();
  const statuses = ['WARD_CABINET', 'IN_USE_WARD', 'CENTRAL_STOCK', 'WASH'];
  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:clipboard-list-bold-duotone" color="primary" />}
        title="สรุปตามแผนก/วอร์ดต้นทาง"
        subheader="จำนวนครั้งแยกตามสถานะก่อนส่ง + ประเภทผ้าที่พบบ่อยในแต่ละแผนก"
      />
      <Scrollbar>
        <TableContainer sx={{ minWidth: 860 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>แผนก/วอร์ด</TableCell>
                <TableCell>ตึก</TableCell>
                <TableCell align="right">ครั้ง</TableCell>
                <TableCell align="right">%</TableCell>
                <TableCell align="right">ชิ้น</TableCell>
                <TableCell>แยกตามสถานะก่อนส่ง</TableCell>
                <TableCell>ประเภทที่พบบ่อย</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {byWard.map((w) => (
                <TableRow key={w.wardId ?? 'none'} hover>
                  <TableCell sx={{ fontWeight: w.wardId != null ? 600 : 400 }}>
                    {w.wardName}
                  </TableCell>
                  <TableCell>{w.buildingName}</TableCell>
                  <TableCell align="right">{w.count}</TableCell>
                  <TableCell align="right">{w.pct}%</TableCell>
                  <TableCell align="right">{w.uniqueItems}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                      {statuses
                        .filter((s) => w.byStatus?.[s])
                        .map((s) => (
                          <Stack key={s} direction="row" spacing={0.5} alignItems="center">
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: sourceStatusColor(s, mode, theme.palette.grey[500]),
                              }}
                            />
                            <Typography variant="caption">
                              {STATUS_LABEL[s]} {w.byStatus[s]}
                            </Typography>
                          </Stack>
                        ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {w.topCategory ? `${w.topCategory.name} (${w.topCategory.count})` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Scrollbar>
    </Card>
  );
}

function RepeatItemsCard({ repeatItems }) {
  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:danger-triangle-bold-duotone" color="warning" />}
        title="ผ้าที่ถูกส่งซักใหม่ซ้ำบ่อย"
        subheader="ส่งซักใหม่ตั้งแต่ 2 ครั้งขึ้นไปในช่วงนี้ — ถ้าคราบไม่ออกซ้ำ ๆ พิจารณาพักใช้งาน/แทงชำรุด"
      />
      <Scrollbar>
        <TableContainer sx={{ minWidth: 760 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>รหัส EPC</TableCell>
                <TableCell>ประเภทผ้า</TableCell>
                <TableCell align="right">ส่งซักใหม่ (ครั้ง)</TableCell>
                <TableCell>มาจาก</TableCell>
                <TableCell>ล่าสุด</TableCell>
                <TableCell>สถานะตอนนี้</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {repeatItems.map((item) => (
                <TableRow key={item.fabricItemId} hover>
                  <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {item.epcCode}
                  </TableCell>
                  <TableCell>{item.categoryName ?? '-'}</TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" color="error.main" component="span">
                      {item.count}
                    </Typography>
                  </TableCell>
                  <TableCell>{item.wardNames.join(', ')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(item.lastAt)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="soft"
                      color={STATUS_COLOR[item.currentStatus] || 'default'}
                      label={STATUS_LABEL[item.currentStatus] ?? item.currentStatus}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Scrollbar>
    </Card>
  );
}

function RecentRecordsCard({ recent, truncated, total }) {
  const { pageRows, pagination } = useClientPagination(recent);
  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:document-text-bold-duotone" color="default" />}
        title="ประวัติผ้าส่งซักใหม่รายชิ้น"
        subheader={
          truncated
            ? `แสดง ${recent.length} รายการล่าสุด จากทั้งหมด ${total} รายการ`
            : `ทั้งหมด ${total} รายการในช่วงที่เลือก`
        }
      />
      <Scrollbar sx={{ maxHeight: 520 }}>
        <TableContainer sx={{ minWidth: 1100 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>ส่งเมื่อ</TableCell>
                <TableCell>รหัส EPC</TableCell>
                <TableCell>ประเภท</TableCell>
                <TableCell>สถานะก่อนส่ง</TableCell>
                <TableCell>แผนก / ตู้</TableCell>
                <TableCell>เหตุผล</TableCell>
                <TableCell>ผู้ส่ง</TableCell>
                <TableCell>ผล</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(r.createdAt)}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {r.epcCode}
                  </TableCell>
                  <TableCell>{r.categoryName ?? '-'}</TableCell>
                  <TableCell>{STATUS_LABEL[r.prevStatus] ?? r.prevStatus}</TableCell>
                  <TableCell>
                    {r.wardName
                      ? `${r.wardName}${r.cabinetName ? ` / ${r.cabinetName}` : ''}`
                      : '-'}
                  </TableCell>
                  <TableCell>{formatRewashReason(r.reasonCode)}</TableCell>
                  <TableCell>{r.userName ?? '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Chip
                      size="small"
                      variant="soft"
                      color={
                        r.closeType === 'WASHED'
                          ? 'success'
                          : r.closeType === 'BYPASSED'
                            ? 'warning'
                            : r.currentStatus === 'REWASH'
                              ? 'info'
                              : 'default'
                      }
                      label={closeStateLabel(r)}
                    />
                    {r.closedAt ? (
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', display: 'block' }}
                      >
                        {fDateTime(r.closedAt)}
                      </Typography>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Scrollbar>
      <TablePaginationBar {...pagination} />
    </Card>
  );
}
