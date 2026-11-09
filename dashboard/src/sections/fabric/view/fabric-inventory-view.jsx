'use client';

import dayjs from 'dayjs';
import { useMemo, useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';
import { useDebounce } from 'src/hooks/use-debounce';
import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetLocationByEpc } from 'src/actions/tracking';
import { useGetMyPermissions } from 'src/actions/permissions';
import {
  fetchAllFabricItems,
  fabricCategoryLabel,
  useGetFabricItemsPage,
  changeFabricItemStatus,
  useGetFabricCategories,
  useGetFabricItemDetail,
} from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { TablePaginationBar } from 'src/components/table';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';

import { FabricExportToolbar } from '../fabric-export-toolbar';
import { useFabricInventoryExport } from './use-fabric-inventory-export';
import {
  STATUS_LABEL,
  STATUS_COLOR,
  FABRIC_STATUSES,
  MANUAL_STATUS_CHANGE_STATUSES,
} from '../fabric-constants';

// ----------------------------------------------------------------------

function FabricStatusChangeSection({ epc, currentStatus, onChanged }) {
  const [toStatus, setToStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const canManualChange = MANUAL_STATUS_CHANGE_STATUSES.includes(currentStatus);

  const handleSave = async () => {
    setSaving(true);
    try {
      await changeFabricItemStatus({ epcCode: epc, fromStatus: currentStatus, toStatus });
      toast.success(`เปลี่ยนสถานะเป็น "${STATUS_LABEL[toStatus] ?? toStatus}" แล้ว`);
      setToStatus('');
      onChanged?.();
    } catch (error) {
      toast.error(error?.message || 'เปลี่ยนสถานะไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        เปลี่ยนสถานะผ้า
      </Typography>

      {!canManualChange ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          ผ้าที่อยู่สถานะ &quot;{STATUS_LABEL[currentStatus] ?? currentStatus}&quot;
          เปลี่ยนสถานะด้วยมือไม่ได้ (พัก/แทงชำรุด มีขั้นตอนอนุมัติแยก)
        </Typography>
      ) : (
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <TextField
            select
            size="small"
            label="เปลี่ยนเป็น"
            value={toStatus}
            onChange={(e) => setToStatus(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            {MANUAL_STATUS_CHANGE_STATUSES.filter((s) => s !== currentStatus).map((s) => (
              <MenuItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </MenuItem>
            ))}
          </TextField>

          <LoadingButton
            variant="contained"
            loading={saving}
            disabled={!toStatus}
            onClick={handleSave}
          >
            บันทึก
          </LoadingButton>
        </Stack>
      )}
    </>
  );
}

function FabricItemDetailDialog({ epc, hospitalId, open, onClose, onChanged }) {
  const { fabricItem, scanHistory, detailLoading, refreshDetail } = useGetFabricItemDetail(
    open ? epc : undefined,
    hospitalId
  );
  const { location, locationLoading } = useGetLocationByEpc(open ? epc : undefined, hospitalId);
  const { myPermissions } = useGetMyPermissions();

  const canChangeStatus = myPermissions.some(
    (p) => p.key === 'web.fabric.inventory.edit' && p.effective
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>ผ้ารหัส {epc}</DialogTitle>
      <DialogContent sx={{ pb: 4 }}>
        {detailLoading ? (
          <LoadingScreen />
        ) : (
          <>
            <Typography component="div" variant="body2" sx={{ mb: 2 }}>
              สถานะปัจจุบัน:{' '}
              <Chip
                size="small"
                variant="soft"
                color={STATUS_COLOR[fabricItem?.status]}
                label={STATUS_LABEL[fabricItem?.status] ?? fabricItem?.status}
              />{' '}
              &nbsp;รอบซัก: {fabricItem?.wash_count ?? 0} ครั้ง
            </Typography>

            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              เพิ่มโดย: {fabricItem?.created_by_name ?? '—'}
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: 'background.neutral' }}
            >
              <Iconify icon="solar:map-point-bold-duotone" width={20} />
              <Typography variant="subtitle2">
                {locationLoading ? 'กำลังโหลดตำแหน่ง...' : location?.name || 'ไม่ทราบตำแหน่งปัจจุบัน'}
              </Typography>
            </Stack>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              ประวัติการสแกน ({scanHistory.length})
            </Typography>

            {scanHistory.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                ยังไม่มีประวัติการสแกน
              </Typography>
            ) : (
              <Scrollbar sx={{ maxHeight: 320 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>เวลาที่สแกน</TableCell>
                        <TableCell>ประเภทเหตุการณ์</TableCell>
                        <TableCell>ข้ามขั้นตอน?</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scanHistory.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{new Date(log.scanned_at).toLocaleString('th-TH')}</TableCell>
                          <TableCell>{log.event_type}</TableCell>
                          <TableCell>{log.is_step_skipped ? '⚠️ ใช่' : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Scrollbar>
            )}

            {canChangeStatus && fabricItem?.status && (
              <FabricStatusChangeSection
                epc={epc}
                currentStatus={fabricItem.status}
                onChanged={() => {
                  refreshDetail();
                  onChanged?.();
                }}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// dayjs/Date -> 'YYYY-MM-DD' ตามเวลาท้องถิ่น ให้ server กรองครอบทั้งวัน (ดู listFabricItems)
const toDateParam = (value) => (value ? dayjs(value).format('YYYY-MM-DD') : undefined);

export function FabricInventoryView() {
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin, hospitals } = useEffectiveHospital();
  // ใส่ชื่อโรงพยาบาลลงในรายงาน export ทุกอัน (ดู HospitalContextChip / operations-restock-report-view.jsx
  // ที่ใช้ pattern เดียวกัน) — superadmin ดูได้หลายโรงพยาบาล ต้องหาชื่อจาก hospitals ที่โหลดมา
  // ส่วน admin/operator มี hospital_name ติดมากับ user อยู่แล้วเพราะสังกัดโรงพยาบาลเดียว
  const hospitalName = isSuperadmin
    ? hospitals.find((h) => h.id === hospitalId)?.name
    : user?.hospital_name;

  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [epcSearch, setEpcSearch] = useState('');
  const [selectedEpc, setSelectedEpc] = useState(null);
  const [registeredFrom, setRegisteredFrom] = useState(null);
  const [registeredTo, setRegisteredTo] = useState(null);
  const [activeDatePreset, setActiveDatePreset] = useState('ทั้งหมด');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const dialog = useBoolean();

  // พิมพ์ค้นหา EPC แล้วรอหยุดพิมพ์ก่อนค่อยยิง request (เดิมยิงทุกตัวอักษร)
  const debouncedSearch = useDebounce(epcSearch.trim(), 400);

  // ตัวกรองทั้งหมดส่งให้ server กรอง + แบ่งหน้า (เดิมโหลดผ้าทั้งโรงพยาบาลมาทีเดียวแล้วกรองวันที่ฝั่ง client
  // — ผ้าหลายพัน/หมื่นชิ้นทำหน้าโหลดนานและค้าง) ชุดเดียวกันใช้ตอน export ด้วย ตัวเลขจึงตรงกับตาราง
  const filters = useMemo(
    () => ({
      hospitalId,
      status: status || undefined,
      categoryId: categoryId || undefined,
      search: debouncedSearch || undefined,
      createdFrom: toDateParam(registeredFrom),
      createdTo: toDateParam(registeredTo),
    }),
    [hospitalId, status, categoryId, debouncedSearch, registeredFrom, registeredTo]
  );

  // ตัวกรองเปลี่ยน -> กลับไปหน้าแรก
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    setPage(0);
  }, [filtersKey]);

  const { categories } = useGetFabricCategories(hospitalId);
  const {
    fabricItems,
    fabricItemsTotal,
    fabricItemsLoading,
    fabricItemsValidating,
    refreshFabricItems,
  } = useGetFabricItemsPage(filters, { page, rowsPerPage });

  // รายการหดจนหน้าปัจจุบันว่าง (เช่น socket รีเฟรชหลังผ้าเปลี่ยนสถานะ) -> ถอยไปหน้าสุดท้ายที่มีข้อมูล
  useEffect(() => {
    if (page > 0 && fabricItemsTotal > 0 && page * rowsPerPage >= fabricItemsTotal) {
      setPage(Math.ceil(fabricItemsTotal / rowsPerPage) - 1);
    }
  }, [page, rowsPerPage, fabricItemsTotal]);

  const handleDatePreset = (preset) => {
    const [from, to] = preset.getRange();
    setRegisteredFrom(from);
    setRegisteredTo(to);
    setActiveDatePreset(preset.label);
  };

  // ผ้าเปลี่ยนสถานะจากที่ไหนก็ได้ (มือถือ operator, edge device ที่จุดชั่ง/พับ, sync ออฟไลน์)
  // -> รีเฟรชตารางนี้เงียบๆ ทันที ไม่ต้อง toast ทุกครั้งเพราะเป็นหน้ารวมที่รับหลาย event พร้อมกัน
  // ครอบทุก event ที่แตะ fabric_items.status ให้ครบ ไม่งั้นหน้านี้ต้องรีเฟรชเองถึงจะเห็นสถานะใหม่
  // (รีเฟรชแค่หน้าที่เปิดอยู่ — โหลดทีละหน้าแล้ว จึงไม่หนักเหมือนเดิม)
  useSocketEvent('fabric:hold', refreshFabricItems);
  useSocketEvent('fabric:decommission', refreshFabricItems);
  useSocketEvent('fabric:decommission-pending', refreshFabricItems);
  useSocketEvent('scan:ward-issue', refreshFabricItems);
  useSocketEvent('scan:ward-receive', refreshFabricItems);
  useSocketEvent('scan:wash-receive', refreshFabricItems);
  useSocketEvent('scan:stock-scan', refreshFabricItems);
  useSocketEvent('scan:status-change', refreshFabricItems);
  useSocketEvent('scan:confirmed', refreshFabricItems);
  useSocketEvent('scan:created', refreshFabricItems);

  const handleRowClick = (epc) => {
    setSelectedEpc(epc);
    dialog.onTrue();
  };

  const { categoryName, exportFileBase, handleExportExcel, getPdfDocument } =
    useFabricInventoryExport({
      fetchAllItems: () => fetchAllFabricItems(filters),
      categories,
      hospitalName,
      registeredFrom,
      registeredTo,
    });

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="คลังผ้าทั้งหมด"
        links={[{ name: 'จัดการผ้าและล็อต' }, { name: 'คลังผ้าทั้งหมด' }]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.fabric.new}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            ลงทะเบียนผ้าใหม่
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ p: 2.5, mb: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label="สถานะ"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">ทั้งหมด</MenuItem>
              {FABRIC_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="ประเภทผ้า"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">ทั้งหมด</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {fabricCategoryLabel(c)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              label="ค้นหารหัส EPC"
              placeholder="พิมพ์บางส่วนของรหัสได้"
              value={epcSearch}
              onChange={(e) => setEpcSearch(e.target.value)}
              sx={{ minWidth: 220 }}
            />
          </Stack>

          <Divider />

          <FabricExportToolbar
            dateFilterProps={{
              startDate: registeredFrom,
              endDate: registeredTo,
              activePreset: activeDatePreset,
              onChangeStartDate: (v) => {
                setRegisteredFrom(v);
                setActiveDatePreset(null);
              },
              onChangeEndDate: (v) => {
                setRegisteredTo(v);
                setActiveDatePreset(null);
              },
              onSelectPreset: handleDatePreset,
              dateLabel: 'วันที่ลงทะเบียน',
            }}
            pdfDocument={getPdfDocument}
            pdfFileName={`${exportFileBase}.pdf`}
            onExportExcel={handleExportExcel}
          />
        </Stack>
      </Card>

      <Card sx={{ position: 'relative' }}>
        {fabricItemsValidating && !fabricItemsLoading && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 }} />
        )}

        {!hospitalId ? (
          <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
        ) : fabricItemsLoading ? (
          <LoadingScreen />
        ) : fabricItems.length === 0 ? (
          <EmptyContent title="ไม่พบผ้าตามเงื่อนไขที่เลือก" sx={{ py: 10 }} />
        ) : (
          <>
            <Scrollbar>
              <TableContainer sx={{ minWidth: 720 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>รหัส EPC</TableCell>
                      <TableCell>ประเภท</TableCell>
                      <TableCell>สถานะ</TableCell>
                      <TableCell>แผนก</TableCell>
                      <TableCell align="right">รอบซัก</TableCell>
                      <TableCell>เพิ่มโดย</TableCell>
                      <TableCell>สร้างเมื่อ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fabricItems.map((item) => (
                      <TableRow
                        key={item.id}
                        hover
                        onClick={() => handleRowClick(item.epc_code)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{item.epc_code}</TableCell>
                        <TableCell>{categoryName(item.fabric_category_id)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="soft"
                            color={STATUS_COLOR[item.status]}
                            label={STATUS_LABEL[item.status] ?? item.status}
                          />
                        </TableCell>
                        <TableCell>
                          {item.status === 'WARD_CABINET' ? item.department_name ?? '—' : '-'}
                        </TableCell>
                        <TableCell align="right">{item.wash_count}</TableCell>
                        <TableCell>{item.created_by_name ?? '—'}</TableCell>
                        <TableCell>{new Date(item.created_at).toLocaleDateString('th-TH')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>

            <TablePaginationBar
              count={fabricItemsTotal}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, next) => setPage(next)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setPage(0);
              }}
            />
          </>
        )}
      </Card>

      <FabricItemDetailDialog
        epc={selectedEpc}
        hospitalId={hospitalId}
        open={dialog.value}
        onClose={dialog.onFalse}
        onChanged={refreshFabricItems}
      />
    </DashboardContent>
  );
}
