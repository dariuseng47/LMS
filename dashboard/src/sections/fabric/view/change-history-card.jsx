'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import { fDateTime } from 'src/utils/format-time';

import { useGetCategoryChanges, getCategoryChangeDetail } from 'src/actions/fabric';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { RevertChangeDialog } from './revert-change-dialog';

// ----------------------------------------------------------------------

const STATUS_META = {
  ACTIVE: { label: 'มีผลอยู่', color: 'success' },
  PARTIALLY_REVERTED: { label: 'ย้อนบางส่วน', color: 'warning' },
  REVERTED: { label: 'ย้อนกลับแล้ว', color: 'default' },
};

const SOURCE_LABEL = { WEB: 'เว็บ', HANDHELD: 'มือถือ' };

function BatchTypeChip({ batch }) {
  return batch.batch_type === 'REVERT' ? (
    <Chip size="small" variant="soft" color="warning" label="ย้อนกลับ" icon={<Iconify icon="solar:restart-bold" width={14} />} />
  ) : (
    <Chip size="small" variant="soft" color="info" label="เปลี่ยนประเภท" />
  );
}

// สรุป "จาก → ไป" ของ batch ในบรรทัดเดียว (batch เดียวอาจมาจากหลายประเภทเดิม)
function changeSummary(batch) {
  return `${batch.from_category_names || '—'}  →  ${batch.to_category_names || '—'}`;
}

function BatchDetailDialog({ batchId, hospitalId, canEdit, onClose, onRevert }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!batchId) return undefined;
    let cancelled = false;
    setDetail(null);
    setLoading(true);
    getCategoryChangeDetail(batchId, hospitalId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId, hospitalId]);

  const batch = detail?.batch;
  const canRevert = canEdit && batch && batch.active_count > 0;

  return (
    <Dialog open={!!batchId} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>รายละเอียดรายการ #{batchId}</DialogTitle>
      <DialogContent dividers>
        {loading && <LoadingScreen sx={{ height: 200 }} />}
        {batch && (
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <BatchTypeChip batch={batch} />
              <Chip
                size="small"
                variant="soft"
                color={STATUS_META[batch.status].color}
                label={STATUS_META[batch.status].label}
              />
              <Chip size="small" variant="outlined" label={batch.mode === 'SINGLE' ? 'รายชิ้น' : `เป็นชุด ${batch.item_count} ชิ้น`} />
              <Chip size="small" variant="outlined" label={`ทำผ่าน${SOURCE_LABEL[batch.source] ?? batch.source}`} />
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="body2">
                <b>เมื่อ:</b> {fDateTime(batch.created_at)} <b>โดย:</b> {batch.created_by_name || '—'}
              </Typography>
              <Typography variant="body2">
                <b>การเปลี่ยน:</b> {changeSummary(batch)}
              </Typography>
              {batch.reverts_batch_id && (
                <Typography variant="body2">
                  <b>ย้อนกลับรายการ:</b> #{batch.reverts_batch_id}
                </Typography>
              )}
              <Typography variant="body2">
                <b>เหตุผล:</b> {batch.reason || '—'}
              </Typography>
            </Stack>

            <TableContainer sx={{ maxHeight: 360, border: (t) => `1px solid ${t.vars.palette.divider}`, borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>รหัส EPC</TableCell>
                    <TableCell>ก่อน</TableCell>
                    <TableCell>หลัง</TableCell>
                    <TableCell>ปัจจุบัน</TableCell>
                    <TableCell align="right">สถานะ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detail.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{item.epc_code}</TableCell>
                      <TableCell>
                        {item.from_group_name ? `${item.from_group_name} › ` : ''}
                        {item.from_category_name}
                      </TableCell>
                      <TableCell>
                        {item.to_group_name ? `${item.to_group_name} › ` : ''}
                        {item.to_category_name}
                      </TableCell>
                      <TableCell>{item.current_category_name}</TableCell>
                      <TableCell align="right">
                        {item.reverted_at ? (
                          <Tooltip title={`ย้อนกลับเมื่อ ${fDateTime(item.reverted_at)} (รายการ #${item.reverted_by_batch_id})`}>
                            <Chip size="small" variant="soft" label="ย้อนแล้ว" />
                          </Tooltip>
                        ) : (
                          <Chip size="small" variant="soft" color="success" label="มีผลอยู่" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
        {canRevert && (
          <Button
            variant="contained"
            color="warning"
            startIcon={<Iconify icon="solar:restart-bold" />}
            onClick={() => onRevert(batch)}
          >
            {batch.batch_type === 'REVERT' ? 'ย้อนการย้อนกลับ' : 'ย้อนกลับรายการนี้'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export function ChangeHistoryCard({ hospitalId, canEdit, refreshKey, onReverted }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [detailId, setDetailId] = useState(null);
  const [revertTarget, setRevertTarget] = useState(null);

  const { changeBatches, changeBatchesTotal, changeBatchesLoading, changeBatchesError, refreshChangeBatches } =
    useGetCategoryChanges(hospitalId, { limit: rowsPerPage, offset: page * rowsPerPage });

  // เปลี่ยน/ย้อนจากแท็บอื่นแล้วโหลดประวัติใหม่ (revalidateIfStale ปิดไว้ จึงต้อง mutate เอง)
  useEffect(() => {
    refreshChangeBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleReverted = useCallback(
    (result) => {
      refreshChangeBatches();
      setDetailId(null);
      onReverted?.(result);
    },
    [refreshChangeBatches, onReverted]
  );

  return (
    <Card>
      <CardHeader
        title="ประวัติการเปลี่ยน & ย้อนกลับ"
        subheader="ทุกการเปลี่ยนถูกเก็บเป็นเวอร์ชัน — เปิดดูค่าก่อน/หลังรายชิ้น และย้อนกลับได้ทั้งชุด (การย้อนกลับก็เป็นรายการใหม่ที่ย้อนซ้ำได้)"
      />

      {!hospitalId ? (
        <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 8 }} />
      ) : changeBatchesLoading ? (
        <LoadingScreen sx={{ height: 240 }} />
      ) : changeBatchesError ? (
        <Alert severity="error" sx={{ m: 3 }}>
          โหลดประวัติไม่สำเร็จ
        </Alert>
      ) : changeBatches.length === 0 ? (
        <EmptyContent
          title="ยังไม่มีประวัติการเปลี่ยนประเภทผ้า"
          description="เมื่อมีการเปลี่ยนประเภทผ้า รายการจะแสดงที่นี่"
          sx={{ py: 8 }}
        />
      ) : (
        <>
          <Scrollbar>
            <TableContainer sx={{ minWidth: 900 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>เมื่อ</TableCell>
                    <TableCell>ผู้ทำรายการ</TableCell>
                    <TableCell>ประเภทรายการ</TableCell>
                    <TableCell>การเปลี่ยน (จาก → ไป)</TableCell>
                    <TableCell align="right">จำนวน</TableCell>
                    <TableCell>เหตุผล</TableCell>
                    <TableCell>สถานะ</TableCell>
                    <TableCell align="right">จัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {changeBatches.map((batch) => (
                    <TableRow key={batch.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetailId(batch.id)}>
                      <TableCell>{batch.id}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(batch.created_at)}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{batch.created_by_name || '—'}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          ผ่าน{SOURCE_LABEL[batch.source] ?? batch.source}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <BatchTypeChip batch={batch} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Typography variant="body2" noWrap title={changeSummary(batch)}>
                          {changeSummary(batch)}
                        </Typography>
                        {batch.reverts_batch_id && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            ย้อนกลับรายการ #{batch.reverts_batch_id}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {batch.item_count} ชิ้น
                        <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                          {batch.mode === 'SINGLE' ? 'รายชิ้น' : 'เป็นชุด'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Typography variant="body2" noWrap title={batch.reason || ''}>
                          {batch.reason || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="soft"
                          color={STATUS_META[batch.status].color}
                          label={STATUS_META[batch.status].label}
                        />
                        {batch.status === 'PARTIALLY_REVERTED' && (
                          <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                            เหลือมีผล {batch.active_count}/{batch.item_count}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="ดูรายละเอียด">
                          <IconButton onClick={(event) => { event.stopPropagation(); setDetailId(batch.id); }}>
                            <Iconify icon="solar:eye-bold" width={18} />
                          </IconButton>
                        </Tooltip>
                        {canEdit && batch.active_count > 0 && (
                          <Tooltip title={batch.batch_type === 'REVERT' ? 'ย้อนการย้อนกลับ' : 'ย้อนกลับ'}>
                            <IconButton
                              color="warning"
                              onClick={(event) => { event.stopPropagation(); setRevertTarget(batch); }}
                            >
                              <Iconify icon="solar:restart-bold" width={18} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>

          <TablePagination
            component="div"
            count={changeBatchesTotal}
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
        </>
      )}

      <BatchDetailDialog
        batchId={detailId}
        hospitalId={hospitalId}
        canEdit={canEdit}
        onClose={() => setDetailId(null)}
        onRevert={(batch) => {
          setDetailId(null);
          setRevertTarget(batch);
        }}
      />

      <RevertChangeDialog
        open={!!revertTarget}
        batchId={revertTarget?.id}
        isRevertBatch={revertTarget?.batch_type === 'REVERT'}
        hospitalId={hospitalId}
        onClose={() => setRevertTarget(null)}
        onReverted={handleReverted}
      />
    </Card>
  );
}
