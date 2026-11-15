import dayjs from 'dayjs';
import { useMemo, useState, Fragment } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import Autocomplete from '@mui/material/Autocomplete';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';

import { usePermission } from 'src/hooks/use-has-permission';

import { fDate, fDateTime } from 'src/utils/format-time';
import { sanitizeFileName, exportRowsToExcel } from 'src/utils/export-excel';

import { useGetFabricCategories } from 'src/actions/fabric';
import { useGetDepartments } from 'src/actions/departments';
import { useGetParAnalysis } from 'src/actions/restockReport';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { useAuthContext } from 'src/auth/hooks';

import { SectionAvatar } from './restock-section-avatar';
import { RestockDateFilterCard } from './restock-date-filter-card';
import { ParLevelDialog } from '../../organization/cabinet-dialogs';
import { getWardOptions, getBuildingOptions } from './restock-fill-history-utils';
import { rowKey, FILTERS, VERDICT_META, buildParAnalysisExcel } from './restock-par-analysis-utils';

// ----------------------------------------------------------------------

// แท็บ "วิเคราะห์ Par" — สถิติผ้าเกิน/ขาด Par ราย (ตู้ x ชนิดผ้า) จากรอบตรวจนับ/เติมผ้าบนแอป handheld
// ให้แอดมินดูว่าตู้ไหนเติมเกินบ่อย ใช้จริงต่อรอบเท่าไร แล้วกด "ปรับ Par" ได้จากแถวนั้นเลย
// (เปิด dialog ตั้ง Par ตัวเดียวกับหน้าโครงสร้างโรงพยาบาล ซึ่งโชว์ค่าแนะนำให้กดใช้ได้ด้วย)
export function RestockParAnalysisCard({ hospitalId, hospitalName }) {
  const { user } = useAuthContext();
  const { can } = usePermission();
  // server ตั้ง Par ได้เฉพาะ ADMIN/SUPERADMIN ที่มีสิทธิ์แก้โครงสร้างโรงพยาบาล (cabinets.controller.js)
  const canEditPar = can('web.organization.edit') && ['ADMIN', 'SUPERADMIN'].includes(user?.role);

  const [startDate, setStartDate] = useState(dayjs().subtract(29, 'day'));
  const [endDate, setEndDate] = useState(dayjs());
  const [activePreset, setActivePreset] = useState('30 วันล่าสุด');
  const [building, setBuilding] = useState(null);
  const [selectedWards, setSelectedWards] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { cabinet: {id,name}, focusCategoryId }

  const { departments } = useGetDepartments(hospitalId);
  const { categories } = useGetFabricCategories(hospitalId);
  const buildingOptions = useMemo(() => getBuildingOptions(departments), [departments]);
  const wardOptions = useMemo(
    () => getWardOptions(departments, building?.id ?? null),
    [departments, building]
  );

  const { range, summary, rows, parAnalysisLoading, refreshParAnalysis } = useGetParAnalysis(
    hospitalId,
    {
      startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined,
      endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined,
      buildingId: building?.id,
      wardIds: selectedWards.map((w) => w.id),
    }
  );

  const filterCounts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.value, rows.filter(f.match).length])),
    [rows]
  );
  const visibleRows = useMemo(() => {
    const match = FILTERS.find((f) => f.value === filter)?.match ?? (() => true);
    return rows.filter(match);
  }, [rows, filter]);

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
        : 'ทุกตึก ทุกวอร์ด';
  const rangeLabel = range ? `${fDate(range.from)} — ${fDate(range.to)}` : '';

  const handleExportExcel = () => {
    if (visibleRows.length === 0) return;
    exportRowsToExcel({
      fileName: `วิเคราะห์Par-${hospitalName ? `${sanitizeFileName(hospitalName)}-` : ''}${sanitizeFileName(scopeLabel)}-${startDate.format('YYYYMMDD')}-${endDate.format('YYYYMMDD')}`,
      ...buildParAnalysisExcel({ rows: visibleRows, hospitalName, scopeLabel, rangeLabel }),
    });
  };

  const overRoundPct =
    summary.roundsAnalyzed > 0
      ? Math.round((summary.overRounds / summary.roundsAnalyzed) * 100)
      : 0;

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
        description="คำนวณจากรอบ ตรวจนับตู้ → เติมผ้า บนแอป handheld — ยิ่งช่วงยาว ค่าแนะนำยิ่งแม่น (แนะนำ 30 วันขึ้นไป)"
      />

      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <StatCard
            icon="solar:clipboard-list-bold-duotone"
            title="รอบเติมผ้าที่วิเคราะห์"
            value={summary.roundsAnalyzed}
            color="primary"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            icon="solar:double-alt-arrow-up-bold-duotone"
            title={`รอบที่มีผ้าเกิน Par (${overRoundPct}%)`}
            value={summary.overRounds}
            color="info"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            icon="solar:t-shirt-bold-duotone"
            title="ผ้าเกิน Par รวม (ชิ้น)"
            value={summary.overQtyTotal}
            color="info"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            icon="solar:tuning-2-bold-duotone"
            title={`ควรปรับ Par (ลด ${summary.reduceSuggested} · เพิ่ม ${summary.increaseSuggested})`}
            value={summary.reduceSuggested + summary.increaseSuggested}
            color="warning"
          />
        </Grid>
      </Grid>

      <Card>
        <CardHeader
          avatar={<SectionAvatar icon="solar:chart-square-bold-duotone" color="info" />}
          title="สถิติผ้าเกิน Par รายตู้"
          subheader={rangeLabel}
          action={
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
                sx={{ minWidth: 240 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="เลือกแผนก/วอร์ด"
                    placeholder={selectedWards.length === 0 ? 'ทั้งหมด' : ''}
                  />
                )}
              />
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<Iconify icon="solar:file-text-bold-duotone" />}
                onClick={handleExportExcel}
                disabled={visibleRows.length === 0}
              >
                Export Excel
              </Button>
            </Stack>
          }
        />

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ px: 3, pt: 2.5 }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.value}
              label={`${f.label} (${filterCounts[f.value] ?? 0})`}
              onClick={() => setFilter(f.value)}
              variant={filter === f.value ? 'filled' : 'soft'}
              color={filter === f.value ? 'primary' : 'default'}
              size="small"
            />
          ))}
          <Box sx={{ flexGrow: 1 }} />
          <Button
            size="small"
            color="inherit"
            startIcon={<Iconify icon="solar:question-circle-bold-duotone" />}
            onClick={() => setShowHelp((v) => !v)}
          >
            วิธีอ่านตัวเลข
          </Button>
        </Stack>

        <Collapse in={showHelp} unmountOnExit>
          <Alert
            severity="info"
            variant="outlined"
            sx={{ mx: 3, mt: 2 }}
            onClose={() => setShowHelp(false)}
          >
            <Typography variant="body2" component="div">
              <b>เกิน Par</b> — จำนวนรอบที่ผ้าในตู้หลังเติมมีมากกว่า Par (เทียบกับ Par ณ ตอนนั้น)
              และจำนวนชิ้นที่เกินรวม/สูงสุด
              <br />
              <b>ใช้ต่อรอบ</b> — ผ้าที่ออกจากตู้ระหว่างรอบเติมสองรอบติดกัน (= หลังเติมรอบก่อน −
              ที่เหลือตอนตรวจนับรอบนี้)
              <br />
              <b>Par แนะนำ</b> — ยอดใช้ต่อรอบที่สูง (เปอร์เซ็นไทล์ 90) + เผื่อ 20%
              ให้ตู้มีพอใช้จนถึงรอบเติมถัดไปเกือบทุกครั้ง ต้องมีอย่างน้อย 3 รอบต่อเนื่องจึงแนะนำได้
              <br />
              <b>เติมเกินบ่อย</b> — เกิน Par ตั้งแต่ 30% ของรอบขึ้นไป ถ้าข้อเสนอเป็น
              &quot;เหมาะสม&quot; แปลว่า Par โอเคแล้ว ปัญหาอยู่ที่การเติมหน้างาน
            </Typography>
          </Alert>
        </Collapse>

        {parAnalysisLoading ? (
          <LoadingScreen sx={{ py: 8 }} />
        ) : visibleRows.length === 0 ? (
          <EmptyContent
            title={rows.length === 0 ? 'ยังไม่มีรอบเติมผ้าในช่วงนี้' : 'ไม่มีรายการตามตัวกรองนี้'}
            description={
              rows.length === 0
                ? 'สถิติเก็บจากการ "ตรวจนับตู้ → จ่ายผ้าเข้าตู้" บนแอป handheld ลองขยายช่วงวันที่'
                : 'ลองเลือกตัวกรองอื่น'
            }
            sx={{ py: 8 }}
          />
        ) : (
          <Scrollbar sx={{ mt: 2 }}>
            <TableContainer sx={{ minWidth: 1040 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ตู้ / แผนก</TableCell>
                    <TableCell>ชนิดผ้า</TableCell>
                    <TableCell align="center">Par ปัจจุบัน</TableCell>
                    <HeadWithHint
                      label="เกิน Par"
                      hint="รอบที่หลังเติมแล้วผ้าในตู้มากกว่า Par / จำนวนรอบทั้งหมด"
                    />
                    <HeadWithHint
                      label="ในตู้ (เฉลี่ย)"
                      hint="จำนวนผ้าในตู้เฉลี่ย ตอนตรวจนับ (ก่อนเติม) และหลังเติม"
                    />
                    <HeadWithHint
                      label="ใช้ต่อรอบ"
                      hint="ผ้าที่ออกจากตู้ระหว่างรอบเติมสองรอบติดกัน"
                    />
                    <HeadWithHint
                      label="Par แนะนำ"
                      hint="ยอดใช้ต่อรอบ (เปอร์เซ็นไทล์ 90) + เผื่อ 20%"
                    />
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRows.map((row) => {
                    const key = rowKey(row);
                    const open = expanded === key;
                    return (
                      <Fragment key={key}>
                        <ParAnalysisRow
                          row={row}
                          open={open}
                          canEditPar={canEditPar}
                          onToggle={() => setExpanded(open ? null : key)}
                          onEditPar={() =>
                            setEditTarget({
                              cabinet: {
                                id: row.cabinetId,
                                name: `${row.cabinetName} (${row.wardName})`,
                              },
                              focusCategoryId: row.categoryId,
                            })
                          }
                        />
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            sx={{ p: 0, borderBottom: open ? undefined : 'none' }}
                          >
                            <Collapse in={open} unmountOnExit>
                              <RoundDetailTable rounds={row.recentRounds} />
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        )}
      </Card>

      <ParLevelDialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        cabinet={editTarget?.cabinet}
        hospitalId={hospitalId}
        categories={categories}
        focusCategoryId={editTarget?.focusCategoryId}
        onSaved={() => refreshParAnalysis()}
      />
    </Stack>
  );
}

// ----------------------------------------------------------------------

function HeadWithHint({ label, hint }) {
  return (
    <TableCell align="center">
      <Tooltip title={hint} arrow>
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}
        >
          {label}
          <Iconify icon="solar:info-circle-bold" width={14} sx={{ color: 'text.disabled' }} />
        </Box>
      </Tooltip>
    </TableCell>
  );
}

function ParAnalysisRow({ row, open, canEditPar, onToggle, onEditPar }) {
  const verdict = VERDICT_META[row.verdict] ?? VERDICT_META.insufficient;
  const hasPar = row.parQty != null;

  return (
    <TableRow hover sx={{ '& > td': { borderBottom: open ? 'none' : undefined } }}>
      <TableCell>
        <Typography variant="subtitle2" noWrap>
          {row.cabinetName}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
          {row.wardName} · {row.buildingName}
        </Typography>
      </TableCell>

      <TableCell>
        <Typography variant="body2">{row.categoryName}</Typography>
      </TableCell>

      <TableCell align="center">
        <Typography variant="subtitle1">{hasPar ? row.parQty : '—'}</Typography>
      </TableCell>

      <TableCell align="center" sx={{ minWidth: 170 }}>
        {!hasPar ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            —
          </Typography>
        ) : row.overRounds === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            ไม่เคยเกิน ({row.rounds} รอบ)
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" sx={{ color: 'info.dark' }}>
              {row.overRounds}/{row.rounds} รอบ ({row.overRate}%)
            </Typography>
            <LinearProgress
              variant="determinate"
              color="info"
              value={Math.min(row.overRate, 100)}
              sx={{ height: 5, borderRadius: 1 }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              รวม {row.overQtyTotal} · สูงสุด {row.overQtyMax} ชิ้น
            </Typography>
          </Stack>
        )}
      </TableCell>

      <TableCell align="center">
        <Typography variant="body2">ก่อนเติม {row.avgBefore}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          หลังเติม {row.avgAfter}
        </Typography>
      </TableCell>

      <TableCell align="center">
        {row.avgUsage == null ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            —
          </Typography>
        ) : (
          <>
            <Typography variant="body2">เฉลี่ย {row.avgUsage}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              สูงสุด {row.maxUsage} ({row.usageSamples} รอบ)
            </Typography>
          </>
        )}
      </TableCell>

      <TableCell align="center" sx={{ minWidth: 150 }}>
        <Stack spacing={0.75} alignItems="center">
          {row.suggestedPar != null && (
            <Typography variant="subtitle1">
              {row.suggestedPar}
              {hasPar && row.suggestedPar !== row.parQty && (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{
                    ml: 0.5,
                    color: row.suggestedPar > row.parQty ? 'warning.dark' : 'info.dark',
                  }}
                >
                  ({row.suggestedPar > row.parQty ? '+' : ''}
                  {row.suggestedPar - row.parQty})
                </Typography>
              )}
            </Typography>
          )}
          <Tooltip title={verdict.hint} arrow>
            <Chip
              size="small"
              variant="soft"
              color={verdict.color}
              icon={<Iconify icon={verdict.icon} width={14} />}
              label={verdict.label}
            />
          </Tooltip>
          {row.frequentOver && (
            <Tooltip title="เกิน Par ตั้งแต่ 30% ของรอบขึ้นไป — ตรวจสอบการเติมหน้างานด้วย" arrow>
              <Chip size="small" variant="outlined" color="info" label="เติมเกินบ่อย" />
            </Tooltip>
          )}
        </Stack>
      </TableCell>

      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
        {canEditPar && (
          <Button
            size="small"
            variant={
              row.verdict === 'reduce' || row.verdict === 'increase' || !hasPar
                ? 'contained'
                : 'outlined'
            }
            color="inherit"
            startIcon={<Iconify icon="solar:pen-bold" width={16} />}
            onClick={onEditPar}
            sx={{ mr: 1 }}
          >
            {hasPar ? 'ปรับ Par' : 'ตั้ง Par'}
          </Button>
        )}
        <Tooltip title={open ? 'ซ่อนรายรอบ' : 'ดูรายรอบ'}>
          <IconButton size="small" onClick={onToggle}>
            <Iconify icon={open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'} />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

function RoundDetailTable({ rounds }) {
  return (
    <Box sx={{ px: 3, py: 2, bgcolor: 'background.neutral' }}>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        รายรอบล่าสุด ({rounds.length} รอบ)
      </Typography>
      <Table size="small" sx={{ mt: 1, '& td, & th': { borderColor: 'divider' } }}>
        <TableHead>
          <TableRow>
            <TableCell>วันเวลา</TableCell>
            <TableCell align="center">Par ตอนนั้น</TableCell>
            <TableCell align="center">ก่อนเติม</TableCell>
            <TableCell align="center">เติม</TableCell>
            <TableCell align="center">หลังเติม</TableCell>
            <TableCell align="center">เทียบ Par</TableCell>
            <TableCell align="center">ใช้ไปจากรอบก่อน</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rounds.map((r) => {
            let status = null;
            if (r.par != null) {
              if (r.after > r.par) status = { label: `เกิน ${r.after - r.par}`, color: 'info' };
              else if (r.after < r.par)
                status = { label: `ขาด ${r.par - r.after}`, color: 'warning' };
              else status = { label: 'ครบ', color: 'success' };
            }
            return (
              <TableRow key={r.roundId}>
                <TableCell>{fDateTime(r.at)}</TableCell>
                <TableCell align="center">{r.par ?? '—'}</TableCell>
                <TableCell align="center">{r.before}</TableCell>
                <TableCell align="center">{r.filled}</TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2">{r.after}</Typography>
                </TableCell>
                <TableCell align="center">
                  {status ? (
                    <Chip size="small" variant="soft" color={status.color} label={status.label} />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell align="center">{r.used ?? '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
