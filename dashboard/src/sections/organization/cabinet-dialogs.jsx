'use client';

import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { fabricCategoryLabel } from 'src/actions/fabric';
import { useGetParAnalysis } from 'src/actions/restockReport';
import { createCabinet, updateCabinet, saveParLevels, useGetParLevels } from 'src/actions/cabinets';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import { LoadingScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

const NewCabinetSchema = zod.object({
  name: zod.string().min(1, { message: 'กรอกชื่อตู้' }),
});

// เพิ่ม/แก้ไขตู้เก็บผ้าให้วอร์ด — เรียกจากในการ์ดวอร์ดนั้นๆ โดยตรง ไม่ต้องเลือกวอร์ดเองอีกแล้ว
// (เดิมอยู่หน้าแยก ต้องเลือกวอร์ดจาก dropdown เอง ตอนนี้ context ชัดเจนอยู่แล้วว่าอยู่วอร์ดไหน)
// mode "edit" ใช้แก้ชื่อตู้เดิม (ต้องส่ง cabinet มาด้วย), mode "create" ใช้เพิ่มตู้ใหม่ (ต้องส่ง ward มาด้วย)
export function CabinetFormDialog({ open, onClose, mode = 'create', ward, cabinet, onSaved }) {
  const isEdit = mode === 'edit';

  const methods = useForm({
    resolver: zodResolver(NewCabinetSchema),
    defaultValues: { name: '' },
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) reset({ name: isEdit ? (cabinet?.name ?? '') : '' });
  }, [open, isEdit, cabinet, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (isEdit) {
        await updateCabinet(cabinet.id, { name: data.name });
        toast.success('แก้ไขตู้สำเร็จ');
      } else {
        await createCabinet({ name: data.name, departmentId: ward.id });
        toast.success('เพิ่มตู้สำเร็จ');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error?.message || (isEdit ? 'แก้ไขไม่สำเร็จ' : 'เพิ่มตู้ไม่สำเร็จ'));
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>{isEdit ? `แก้ไขตู้เก็บผ้า` : `เพิ่มตู้เก็บผ้า — ${ward?.name}`}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Field.Text name="name" label="ชื่อตู้ (เช่น ตู้ผ้า A1)" autoFocus />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {isEdit ? 'บันทึก' : 'เพิ่ม'}
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}

// ตั้งจำนวนผ้าที่ต้องมี (par level) ต่อประเภทให้ตู้หนึ่งใบ
// โชว์ "Par แนะนำ" จากสถิติ 30 วันล่าสุดใต้ช่องกรอก (กดใช้ได้ทันที) — ดูแท็บ "วิเคราะห์ Par" ในหน้า
// ประวัติ & วิเคราะห์การเติมผ้า, focusCategoryId = ไฮไลท์แถวที่กดมาจากหน้านั้น
export function ParLevelDialog({
  open,
  onClose,
  cabinet,
  hospitalId,
  categories,
  onSaved,
  focusCategoryId,
}) {
  const { parLevels, parLevelsLoading, refreshParLevels } = useGetParLevels(
    open ? cabinet?.id : undefined,
    hospitalId
  );
  const { rows: analysisRows } = useGetParAnalysis(
    hospitalId,
    { cabinetId: cabinet?.id },
    { enabled: open && !!cabinet?.id }
  );
  const suggestionByCategory = useMemo(
    () =>
      new Map(
        analysisRows
          .filter((r) => r.suggestedPar != null)
          .map((r) => [r.categoryId, { suggestedPar: r.suggestedPar, samples: r.usageSamples }])
      ),
    [analysisRows]
  );
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && !parLevelsLoading && parLevels) {
      const map = {};
      parLevels.forEach((p) => {
        map[p.fabric_category_id] = { qty: p.par_level_qty, warningPct: p.warning_pct };
      });
      setRows(map);
    }
  }, [open, parLevels, parLevelsLoading]);

  const handleChange = (categoryId, field, value) => {
    setRows((prev) => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [field]: value },
    }));
  };

  const handleSave = useCallback(async () => {
    const payload = Object.entries(rows)
      .filter(([, v]) => Number(v?.qty) > 0)
      .map(([categoryId, v]) => ({
        fabricCategoryId: Number(categoryId),
        parLevelQty: Number(v.qty),
        warningPct: v.warningPct ? Number(v.warningPct) : 20,
      }));

    if (payload.length === 0) {
      toast.error('กรอกจำนวนอย่างน้อย 1 ประเภท');
      return;
    }

    setSaving(true);
    try {
      await saveParLevels(cabinet.id, payload);
      toast.success('บันทึกจำนวนผ้าสำเร็จ');
      refreshParLevels();
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }, [rows, cabinet, refreshParLevels, onSaved, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>จำนวนผ้าที่ต้องมี — {cabinet?.name}</DialogTitle>
      <DialogContent>
        {parLevelsLoading ? (
          <LoadingScreen sx={{ height: 200 }} />
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {suggestionByCategory.size > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                ค่าแนะนำคำนวณจากยอดใช้จริงต่อรอบเติมใน 30 วันล่าสุด (+ เผื่อ 20%) — กด
                &quot;ใช้&quot; เพื่อกรอกให้
              </Typography>
            )}
            {categories.map((c) => {
              const suggestion = suggestionByCategory.get(c.id);
              const current = rows[c.id]?.qty;
              const showSuggestion = suggestion && Number(current) !== suggestion.suggestedPar;
              return (
                <Stack
                  key={c.id}
                  direction="row"
                  spacing={2}
                  alignItems="flex-start"
                  sx={
                    focusCategoryId === c.id
                      ? { bgcolor: 'action.selected', borderRadius: 1, p: 1, mx: -1 }
                      : undefined
                  }
                >
                  <TextField
                    label="ประเภทผ้า"
                    value={fabricCategoryLabel(c)}
                    disabled
                    sx={{ flex: 1 }}
                    size="small"
                  />
                  <TextField
                    label="จำนวนที่ต้องมี (Par)"
                    type="number"
                    size="small"
                    value={rows[c.id]?.qty ?? ''}
                    onChange={(e) => handleChange(c.id, 'qty', e.target.value)}
                    autoFocus={focusCategoryId === c.id}
                    sx={{ width: 160 }}
                    helperText={
                      showSuggestion ? (
                        <Box component="span" sx={{ display: 'inline-flex', gap: 0.75 }}>
                          แนะนำ {suggestion.suggestedPar}
                          <Link
                            component="button"
                            type="button"
                            variant="caption"
                            underline="always"
                            onClick={() =>
                              handleChange(c.id, 'qty', String(suggestion.suggestedPar))
                            }
                          >
                            ใช้
                          </Link>
                        </Box>
                      ) : undefined
                    }
                  />
                  <TextField
                    label="% เตือน"
                    type="number"
                    size="small"
                    value={rows[c.id]?.warningPct ?? 20}
                    onChange={(e) => handleChange(c.id, 'warningPct', e.target.value)}
                    sx={{ width: 120 }}
                  />
                </Stack>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={handleSave}>
          บันทึก
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
