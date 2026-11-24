'use client';

import dayjs from 'dayjs';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

import { useSocketEvent } from 'src/hooks/use-socket-event';

import { fDate, fTime, fDateTime } from 'src/utils/format-time';
import { sanitizeFileName, exportRowsToExcel } from 'src/utils/export-excel';

import { varAlpha } from 'src/theme/styles';
import { useGetDevices } from 'src/actions/devices';
import {
  fabricCategoryLabel,
  useGetRegistrations,
  fetchAllRegistrations,
  useGetRegistrationDetail,
} from 'src/actions/fabric';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { Scrollbar } from 'src/components/scrollbar';
import { TablePaginationBar } from 'src/components/table';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { SectionAvatar } from 'src/sections/operations/view/restock-section-avatar';
import { deviceName, deviceDetail, DEVICE_TYPE_ICON } from 'src/sections/devices/device-constants';

import { FabricListReportPDF } from '../fabric-report-pdf';
import { FabricExportToolbar } from '../fabric-export-toolbar';
import { STATUS_COLOR, STATUS_LABEL } from '../fabric-constants';
import { FabricItemProfileDialog } from '../fabric-item-profile-dialog';
import { fabricPdfRange, fabricRangeLabel } from '../fabric-export-utils';

// ----------------------------------------------------------------------

const REGISTER_DEVICE_TYPES = ['WEIGHT_GATE', 'RFID_CHECKPOINT', 'HANDHELD'];

// ช่องทางที่ไม่มีเครื่อง (มีเครื่อง = ใช้ชื่อเครื่องแทน)
const SOURCE_META = {
  MANUAL: {
    name: 'พิมพ์ / วางรหัสเอง',
    detail: 'ไม่ผ่านเครื่องสแกน',
    icon: 'solar:keyboard-bold-duotone',
  },
  LEGACY: {
    name: 'ไม่มีข้อมูลเครื่อง',
    detail: 'ลงทะเบียนก่อนเริ่มเก็บประวัติ',
    icon: 'solar:question-circle-bold-duotone',
  },
};

// เครื่อง/ช่องทางของรอบ -> { name, detail, icon }
function channelOf({ source, device }) {
  if (device) {
    return {
      name: deviceName(device.deviceType),
      detail: deviceDetail(device),
      icon: DEVICE_TYPE_ICON[device.deviceType],
    };
  }
  return SOURCE_META[source] ?? SOURCE_META.LEGACY;
}

// บรรทัดเดียวสำหรับไฟล์ Export — หลายเครื่องประเภทเดียวกันต้องแยกออกจากชื่อในไฟล์ได้
function channelLabel(batch) {
  const { name, detail } = channelOf(batch);
  return batch.device ? `${name} · ${detail}` : name;
}

const categoryNameOf = (row) => row.categoryName || 'ไม่ระบุประเภท';

const EXPORT_COLUMNS = [
  { key: 'createdAt', label: 'วันเวลา', width: 190 },
  { key: 'category', label: 'ประเภทผ้า', width: 180 },
  { key: 'group', label: 'หมวดหมู่', width: 130 },
  { key: 'lot', label: 'ล็อต', width: 140 },
  { key: 'channel', label: 'ลงผ่านเครื่อง', width: 250 },
  { key: 'createdBy', label: 'ลงทะเบียนโดย', width: 160 },
  { key: 'itemCount', label: 'จำนวน (ชิ้น)', width: 110, align: 'right' },
];

const toExportRow = (batch) => ({
  createdAt: fDateTime(batch.createdAt),
  category: categoryNameOf(batch),
  group: batch.groupName ?? '—',
  lot: batch.lotCode ?? '—',
  itemCount: batch.itemCount,
  channel: channelLabel(batch),
  createdBy: batch.createdByName ?? '—',
});

// ----------------------------------------------------------------------

const BREAKDOWN_LIMIT = 6;

// แถบสรุปยอดต่อรายการ (ประเภทผ้า / เครื่อง) — rows: [{ key, icon, name, detail, itemCount, batchCount }]
function BreakdownCard({ title, subheader, icon, color, rows, total }) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, BREAKDOWN_LIMIT);

  return (
    <Card sx={{ height: 1 }}>
      <CardHeader
        avatar={<SectionAvatar icon={icon} color={color} />}
        title={title}
        subheader={subheader}
      />
      <CardContent>
        {rows.length === 0 ? (
          <EmptyContent
            title="ไม่มีข้อมูลในช่วงที่เลือก"
            sx={{ py: 3 }}
            slotProps={{ img: { maxWidth: 96 } }}
          />
        ) : (
          <Stack spacing={2}>
            {visibleRows.map((row) => (
              <Stack key={row.key} direction="row" spacing={1.5} alignItems="center">
                <Iconify
                  icon={row.icon}
                  width={24}
                  sx={{ flexShrink: 0, color: `${color}.main` }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="baseline" spacing={1}>
                    <Typography variant="subtitle2" noWrap sx={{ minWidth: 0 }}>
                      {row.name}
                    </Typography>
                    {row.detail && (
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ flex: 1, minWidth: 0, color: 'text.disabled' }}
                      >
                        {row.detail}
                      </Typography>
                    )}
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    color={color}
                    value={total > 0 ? (row.itemCount / total) * 100 : 0}
                    sx={{ mt: 0.75, height: 6, borderRadius: 1 }}
                  />
                </Box>
                <Box sx={{ flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
                  <Typography variant="subtitle2">
                    {row.itemCount.toLocaleString('th-TH')} ชิ้น
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {row.batchCount.toLocaleString('th-TH')} รอบ
                  </Typography>
                </Box>
              </Stack>
            ))}
            {rows.length > BREAKDOWN_LIMIT && (
              <Button size="small" color="inherit" onClick={() => setExpanded((prev) => !prev)}>
                {expanded ? 'ย่อรายการ' : `ดูทั้งหมด (${rows.length})`}
              </Button>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

function BatchItems({ batchId, hospitalId, batchCategoryName, onOpenItem }) {
  const { registrationItems, registrationItemsLoading, registrationItemsError } =
    useGetRegistrationDetail(batchId, hospitalId);

  if (registrationItemsLoading) {
    return (
      <Typography variant="body2" sx={{ py: 2, color: 'text.secondary' }}>
        กำลังโหลด…
      </Typography>
    );
  }
  if (registrationItemsError) return <Alert severity="error">โหลดรายชิ้นไม่สำเร็จ</Alert>;

  return (
    <Box
      sx={{
        gap: 1,
        display: 'grid',
        maxHeight: 320,
        overflowY: 'auto',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      }}
    >
      {registrationItems.map((item) => (
        <Stack
          key={item.epcCode}
          component={item.transferred ? 'div' : 'button'}
          type={item.transferred ? undefined : 'button'}
          onClick={item.transferred ? undefined : () => onOpenItem(item.epcCode)}
          alignItems="flex-start"
          spacing={0.5}
          sx={{
            p: 1.25,
            border: 0,
            minWidth: 0,
            borderRadius: 1,
            color: 'inherit',
            font: 'inherit',
            textAlign: 'left',
            bgcolor: 'background.paper',
            ...(!item.transferred && {
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }),
          }}
        >
          <Typography variant="body2" noWrap sx={{ width: 1, fontFamily: 'monospace' }}>
            {item.epcCode}
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {item.transferred ? (
              <Label color="default">โอนย้ายไปโรงพยาบาลอื่นแล้ว</Label>
            ) : (
              <Label color={STATUS_COLOR[item.status] ?? 'default'}>
                {STATUS_LABEL[item.status] ?? item.status}
              </Label>
            )}
            {item.categoryName && item.categoryName !== batchCategoryName && (
              <Label color="info">ตอนนี้เป็น {item.categoryName}</Label>
            )}
          </Stack>
        </Stack>
      ))}
    </Box>
  );
}

function BatchRow({ batch, hospitalId, onOpenItem }) {
  const [open, setOpen] = useState(false);
  const channel = channelOf(batch);

  return (
    <>
      <TableRow hover onClick={() => setOpen((prev) => !prev)} sx={{ cursor: 'pointer' }}>
        <TableCell width={48} sx={{ pr: 0 }}>
          <IconButton size="small" aria-label={open ? 'ปิดรายชิ้น' : 'ดูรายชิ้น'}>
            <Iconify icon={open ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill'} />
          </IconButton>
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          <Typography variant="subtitle2">{fDate(batch.createdAt)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {fTime(batch.createdAt)}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="subtitle2">{categoryNameOf(batch)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {[batch.groupName, batch.lotCode ? `ล็อต ${batch.lotCode}` : 'ไม่ผูกล็อต']
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </TableCell>
        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
          <Chip
            size="small"
            variant="soft"
            color="success"
            label={`${batch.itemCount.toLocaleString('th-TH')} ชิ้น`}
          />
          {batch.skippedCount > 0 && (
            <Typography
              variant="caption"
              component="div"
              sx={{ mt: 0.5, color: 'text.secondary' }}
            >
              ข้ามซ้ำ {batch.skippedCount.toLocaleString('th-TH')}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Iconify
              icon={channel.icon}
              width={24}
              sx={{ flexShrink: 0, color: batch.device ? 'primary.main' : 'text.disabled' }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">{channel.name}</Typography>
              {channel.detail && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {channel.detail}
                </Typography>
              )}
            </Box>
          </Stack>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{batch.createdByName ?? '—'}</Typography>
          {batch.confirmedByName && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              ยืนยันโดย {batch.confirmedByName}
            </Typography>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell
          colSpan={6}
          sx={{ p: 0, borderBottom: open ? undefined : 'none', bgcolor: 'background.neutral' }}
        >
          <Collapse in={open} unmountOnExit>
            <Box sx={{ p: 2 }}>
              <BatchItems
                batchId={batch.id}
                hospitalId={hospitalId}
                batchCategoryName={batch.categoryName}
                onOpenItem={onOpenItem}
              />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ----------------------------------------------------------------------

// ตัวกรองเครื่อง/ช่องทางเก็บเป็นค่าเดียว: 'device:10' | 'source:MANUAL' | ''
function channelFilterParams(channel) {
  const [kind, value] = channel.split(':');
  if (kind === 'device') return { deviceId: Number(value) };
  if (kind === 'source') return { source: value };
  return {};
}

// แท็บ "ประวัติการลงทะเบียนผ้า" — ลงเมื่อไหร่ ผ้าอะไรบ้าง ผ่านเครื่องไหน (1 แถว = กดยืนยัน 1 ครั้ง)
export function RegistrationHistoryCard({ hospitalId, hospitalName, categories }) {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [activePreset, setActivePreset] = useState('ทั้งหมด');
  const [categoryId, setCategoryId] = useState('');
  const [channel, setChannel] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [profile, setProfile] = useState({ open: false, epc: null });

  const filters = useMemo(
    () => ({
      from: from ? dayjs(from).format('YYYY-MM-DD') : undefined,
      to: to ? dayjs(to).format('YYYY-MM-DD') : undefined,
      categoryId: categoryId || undefined,
      ...channelFilterParams(channel),
    }),
    [from, to, categoryId, channel]
  );

  useEffect(() => {
    setPage(0);
  }, [filters]);

  const {
    registrations,
    registrationsTotal,
    registrationsSummary: summary,
    registrationsLoading,
    registrationsError,
    refreshRegistrations,
  } = useGetRegistrations(hospitalId, filters, { page, rowsPerPage });

  // เปิดแท็บทีไรดึงใหม่ (แคชของ SWR ไม่ revalidate เอง) + มีรอบใหม่จากที่ไหนก็ตาม -> รีเฟรชทันที
  useEffect(() => {
    refreshRegistrations();
  }, [refreshRegistrations]);
  useSocketEvent('fabric:registered', () => refreshRegistrations());

  const { devices: allDevices } = useGetDevices(hospitalId);
  const channelOptions = useMemo(
    () => [
      ...allDevices
        .filter((d) => REGISTER_DEVICE_TYPES.includes(d.device_type))
        .sort(
          (a, b) =>
            REGISTER_DEVICE_TYPES.indexOf(a.device_type) -
              REGISTER_DEVICE_TYPES.indexOf(b.device_type) || a.id - b.id
        )
        .map((d) => ({
          value: `device:${d.id}`,
          icon: DEVICE_TYPE_ICON[d.device_type],
          label: [
            deviceName(d.device_type),
            deviceDetail({
              id: d.id,
              ipAddress: d.ip_address,
              port: d.port,
              caretakerName: d.caretaker_name,
            }),
          ].join(' · '),
        })),
      ...Object.entries(SOURCE_META).map(([source, meta]) => ({
        value: `source:${source}`,
        icon: meta.icon,
        label: meta.name,
      })),
    ],
    [allDevices]
  );

  const categoryRows = useMemo(
    () =>
      summary.byCategory.map((row) => ({
        key: `${row.categoryId ?? 'none'}-${row.categoryName}`,
        icon: 'solar:t-shirt-bold-duotone',
        name: categoryNameOf(row),
        detail: row.groupName,
        itemCount: row.itemCount,
        batchCount: row.batchCount,
      })),
    [summary.byCategory]
  );
  const channelRows = useMemo(
    () =>
      summary.byDevice.map((row) => ({
        key: `${row.source}-${row.device?.id ?? ''}`,
        ...channelOf(row),
        itemCount: row.itemCount,
        batchCount: row.batchCount,
      })),
    [summary.byDevice]
  );

  const rangeSuffix =
    from || to
      ? `-${dayjs(from ?? to).format('YYYYMMDD')}-${dayjs(to ?? from).format('YYYYMMDD')}`
      : '';
  const exportFileBase = `ประวัติการลงทะเบียนผ้า${hospitalName ? `-${sanitizeFileName(hospitalName)}` : ''}${rangeSuffix}`;
  const exportTitle = 'รายงานประวัติการลงทะเบียนผ้า';

  const loadExportRows = async () =>
    (await fetchAllRegistrations(hospitalId, filters)).map(toExportRow);

  const handleExportExcel = async () => {
    const rows = await loadExportRows();
    exportRowsToExcel({
      fileName: exportFileBase,
      sheetName: 'ประวัติการลงทะเบียนผ้า',
      title: exportTitle,
      subtitle: [hospitalName, `ช่วงเวลา ${fabricRangeLabel(from, to)}`].filter(Boolean).join(' · '),
      columns: EXPORT_COLUMNS,
      rows,
    });
  };

  const renderPdfDocument = async () => (
    <FabricListReportPDF
      title={exportTitle}
      hospitalName={hospitalName}
      range={fabricPdfRange(from, to)}
      columns={EXPORT_COLUMNS}
      rows={await loadExportRows()}
    />
  );

  const hasFilter = !!(from || to || categoryId || channel);

  const renderTable = () => {
    if (registrationsLoading) return <LoadingScreen sx={{ height: 240 }} />;
    if (registrationsError) {
      return (
        <Alert
          severity="error"
          sx={{ m: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => refreshRegistrations()}>
              ลองใหม่
            </Button>
          }
        >
          โหลดประวัติการลงทะเบียนไม่สำเร็จ
        </Alert>
      );
    }
    if (registrations.length === 0) {
      return (
        <EmptyContent
          title={hasFilter ? 'ไม่พบประวัติตามตัวกรองที่เลือก' : 'ยังไม่มีประวัติการลงทะเบียนผ้า'}
          description={hasFilter ? undefined : 'ลงทะเบียนผ้าแล้ว รอบนั้นจะขึ้นที่นี่'}
          sx={{ py: 8 }}
        />
      );
    }
    return (
      <>
        <Scrollbar>
          <TableContainer sx={{ minWidth: 900 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={48} />
                  <TableCell>ลงทะเบียนเมื่อ</TableCell>
                  <TableCell>ผ้า</TableCell>
                  <TableCell align="right">จำนวน</TableCell>
                  <TableCell>ลงผ่านเครื่อง</TableCell>
                  <TableCell>ลงทะเบียนโดย</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {registrations.map((batch) => (
                  <BatchRow
                    key={batch.id}
                    batch={batch}
                    hospitalId={hospitalId}
                    onOpenItem={(epc) => setProfile({ open: true, epc })}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
        <TablePaginationBar
          count={registrationsTotal}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, next) => setPage(next)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
        />
      </>
    );
  };

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <FabricExportToolbar
            dateFilterProps={{
              startDate: from,
              endDate: to,
              activePreset,
              onChangeStartDate: (value) => {
                setFrom(value);
                setActivePreset(null);
              },
              onChangeEndDate: (value) => {
                setTo(value);
                setActivePreset(null);
              },
              onSelectPreset: (preset) => {
                const [start, end] = preset.getRange();
                setFrom(start);
                setTo(end);
                setActivePreset(preset.label);
              },
              dateLabel: 'วันที่ลงทะเบียน',
            }}
            pdfDocument={renderPdfDocument}
            pdfFileName={`${exportFileBase}.pdf`}
            onExportExcel={handleExportExcel}
          />

          <Divider sx={{ borderStyle: 'dashed' }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              select
              fullWidth
              size="small"
              label="ประเภทผ้า"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              sx={{ maxWidth: { sm: 320 } }}
            >
              <MenuItem value="">ทุกประเภท</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {fabricCategoryLabel(category)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="ลงผ่านเครื่อง"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              sx={{ maxWidth: { sm: 320 } }}
            >
              <MenuItem value="">ทุกเครื่อง / ทุกช่องทาง</MenuItem>
              {channelOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Iconify icon={option.icon} width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            {(categoryId || channel) && (
              <Button
                color="inherit"
                onClick={() => {
                  setCategoryId('');
                  setChannel('');
                }}
                startIcon={<Iconify icon="solar:restart-bold" />}
                sx={{ flexShrink: 0 }}
              >
                ล้างตัวกรอง
              </Button>
            )}
          </Stack>
        </Stack>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <StatCard
            icon="solar:t-shirt-bold-duotone"
            title="ผ้าที่ลงทะเบียน (ชิ้น)"
            value={summary.itemCount.toLocaleString('th-TH')}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            icon="solar:clipboard-list-bold-duotone"
            title="รอบการลงทะเบียน"
            value={summary.batchCount.toLocaleString('th-TH')}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            icon="solar:tag-bold-duotone"
            title="ประเภทผ้า"
            value={summary.byCategory.length.toLocaleString('th-TH')}
            color="warning"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <BreakdownCard
            title="ลงทะเบียนผ้าอะไรบ้าง"
            subheader="ประเภทตอนลงทะเบียน ในช่วงที่เลือก"
            icon="solar:t-shirt-bold-duotone"
            color="primary"
            rows={categoryRows}
            total={summary.itemCount}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownCard
            title="ลงผ่านเครื่องไหน"
            subheader="จำนวนผ้าต่อเครื่อง / ช่องทาง ในช่วงที่เลือก"
            icon="solar:wi-fi-router-bold-duotone"
            color="info"
            rows={channelRows}
            total={summary.itemCount}
          />
        </Grid>
      </Grid>

      <Card>
        <CardHeader
          avatar={<SectionAvatar icon="solar:history-bold-duotone" color="secondary" />}
          title="ประวัติการลงทะเบียนผ้า"
          subheader="แต่ละแถว = กดยืนยันลงทะเบียน 1 ครั้ง — แตะแถวเพื่อดูรายชิ้นและสถานะตอนนี้"
          sx={{
            pb: 2.5,
            borderBottom: (theme) =>
              `dashed 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.2)}`,
          }}
        />
        {renderTable()}
      </Card>

      <FabricItemProfileDialog
        epc={profile.epc}
        hospitalId={hospitalId}
        open={profile.open}
        onClose={() => setProfile((prev) => ({ ...prev, open: false }))}
      />
    </Stack>
  );
}
