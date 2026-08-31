'use client';

import { useState } from 'react';

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

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';
import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetLocationByEpc } from 'src/actions/tracking';
import { useGetMyPermissions } from 'src/actions/permissions';
import {
  useGetFabricItems,
  changeFabricItemStatus,
  useGetFabricCategories,
  useGetFabricItemDetail,
} from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

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

export function FabricInventoryView() {
  const { hospitalId } = useEffectiveHospital();

  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [epcSearch, setEpcSearch] = useState('');
  const [selectedEpc, setSelectedEpc] = useState(null);

  const dialog = useBoolean();

  const { categories } = useGetFabricCategories(hospitalId);
  const { fabricItems, fabricItemsLoading, fabricItemsEmpty, refreshFabricItems } = useGetFabricItems({
    hospitalId,
    status: status || undefined,
    categoryId: categoryId || undefined,
    epcCode: epcSearch || undefined,
  });

  // ผ้าเปลี่ยนสถานะจากที่ไหนก็ได้ (มือถือ operator, edge device ที่จุดชั่ง/พับ, sync ออฟไลน์)
  // -> รีเฟรชตารางนี้เงียบๆ ทันที ไม่ต้อง toast ทุกครั้งเพราะเป็นหน้ารวมที่รับหลาย event พร้อมกัน
  // ครอบทุก event ที่แตะ fabric_items.status ให้ครบ ไม่งั้นหน้านี้ต้องรีเฟรชเองถึงจะเห็นสถานะใหม่
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

  const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? '-';

  const handleRowClick = (epc) => {
    setSelectedEpc(epc);
    dialog.onTrue();
  };

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

      <Card sx={{ p: 2.5, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
          label="หมวดหมู่ผ้า"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">ทั้งหมด</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          label="ค้นหารหัส EPC"
          value={epcSearch}
          onChange={(e) => setEpcSearch(e.target.value)}
          sx={{ minWidth: 200 }}
        />
      </Card>

      <Card>
        {!hospitalId ? (
          <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
        ) : fabricItemsLoading ? (
          <LoadingScreen />
        ) : fabricItemsEmpty ? (
          <EmptyContent title="ไม่พบผ้าตามเงื่อนไขที่เลือก" sx={{ py: 10 }} />
        ) : (
          <Scrollbar>
            <TableContainer sx={{ minWidth: 720 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>รหัส EPC</TableCell>
                    <TableCell>หมวดหมู่</TableCell>
                    <TableCell>สถานะ</TableCell>
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
                      <TableCell align="right">{item.wash_count}</TableCell>
                      <TableCell>{item.created_by_name ?? '—'}</TableCell>
                      <TableCell>{new Date(item.created_at).toLocaleDateString('th-TH')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
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
