'use client';

import { useMemo, useState, useEffect } from 'react';

import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useGetUserPermissions, updateUserPermissions } from 'src/actions/permissions';

import { toast } from 'src/components/snackbar';
import { LoadingScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

export function PermissionEditorDialog({ open, onClose, targetUser, onSaved }) {
  const { permissions, permissionsLoading, refreshPermissions } = useGetUserPermissions(
    open ? targetUser?.id : undefined
  );

  // local[key] = ค่าที่ toggle แสดงอยู่ตอนนี้ (เริ่มจาก effective ที่ดึงมา)
  // resetKeys = key ที่กด "รีเซ็ตเป็นค่าเริ่มต้น" ไว้ — ต้องส่ง effect: null ตอน save ไม่ใช่ GRANT/DENY
  const [local, setLocal] = useState({});
  const [resetKeys, setResetKeys] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && permissions.length) {
      setLocal(Object.fromEntries(permissions.map((p) => [p.key, p.effective])));
      setResetKeys(new Set());
    }
  }, [open, permissions]);

  const hasChanges = useMemo(() => {
    if (resetKeys.size > 0) return true;
    return permissions.some((p) => local[p.key] !== p.effective);
  }, [permissions, local, resetKeys]);

  const handleToggle = (key, checked) => {
    setLocal((prev) => ({ ...prev, [key]: checked }));
    setResetKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleReset = (perm) => {
    setLocal((prev) => ({ ...prev, [perm.key]: perm.roleDefault }));
    setResetKeys((prev) => new Set(prev).add(perm.key));
  };

  const handleSave = async () => {
    const overrides = [];
    permissions.forEach((p) => {
      if (resetKeys.has(p.key)) {
        overrides.push({ permKey: p.key, effect: null });
      } else if (local[p.key] !== p.effective) {
        overrides.push({ permKey: p.key, effect: local[p.key] ? 'GRANT' : 'DENY' });
      }
    });

    if (overrides.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await updateUserPermissions(targetUser.id, overrides);
      toast.success('บันทึกสิทธิ์การเข้าถึงสำเร็จ');
      refreshPermissions();
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>สิทธิ์การเข้าถึง — {targetUser?.full_name}</DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          เปิด/ปิดสิทธิ์เฉพาะบุคคลสำหรับ {targetUser?.username} — นอกเหนือจากนี้ operator
          จะใช้สิทธิ์พื้นฐานตามปกติของบทบาท
        </Typography>

        {permissionsLoading ? (
          <LoadingScreen sx={{ height: 200 }} />
        ) : (
          <Stack divider={<Divider flexItem />} spacing={2}>
            {permissions.map((p) => {
              const isPendingReset = resetKeys.has(p.key);
              const isOverridden = !isPendingReset && p.source === 'override';

              return (
                <Stack key={p.key} spacing={0.5}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!!local[p.key]}
                        onChange={(e) => handleToggle(p.key, e.target.checked)}
                      />
                    }
                    label={<Typography variant="subtitle2">{p.label}</Typography>}
                  />

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 6 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      ค่าเริ่มต้นของบทบาท: {p.roleDefault ? 'เปิด' : 'ปิด'}
                    </Typography>

                    {isOverridden && (
                      <>
                        <Typography variant="caption" sx={{ color: 'warning.main' }}>
                          • ปรับสิทธิ์เฉพาะบุคคลแล้ว
                        </Typography>
                        <Link
                          component="button"
                          type="button"
                          variant="caption"
                          onClick={() => handleReset(p)}
                        >
                          รีเซ็ตเป็นค่าเริ่มต้น
                        </Link>
                      </>
                    )}
                  </Stack>
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
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={!hasChanges}
          onClick={handleSave}
        >
          บันทึก
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
