'use client';

import { z as zod } from 'zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { createDevice, updateDevice } from 'src/actions/devices';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';

import { DEVICE_TYPES, DEVICE_TYPE_LABEL } from '../device-constants';

// ----------------------------------------------------------------------

const DeviceFormSchema = zod.object({
  deviceType: zod.enum(DEVICE_TYPES, { message: 'เลือกประเภทอุปกรณ์' }),
  caretakerName: zod.string().optional(),
  caretakerPhone: zod.string().optional(),
  rssiThresholdDbm: zod.coerce.number().int().optional(),
  targetBundleSize: zod.preprocess(
    (val) => (val === '' ? undefined : val),
    zod.coerce.number().int().positive().optional()
  ),
  ipAddress: zod.string().optional(),
  port: zod.preprocess(
    (val) => (val === '' ? undefined : val),
    zod.coerce.number().int().min(1).max(65535).optional()
  ),
});

const EMPTY_DEVICE_FORM = {
  deviceType: 'WEIGHT_GATE',
  caretakerName: '',
  caretakerPhone: '',
  rssiThresholdDbm: -65,
  targetBundleSize: '',
  ipAddress: '',
  port: '',
};

// device (row จาก API, snake_case) -> ค่าเริ่มต้นของฟอร์ม
function deviceToForm(device) {
  return {
    deviceType: device.device_type,
    caretakerName: device.caretaker_name ?? '',
    caretakerPhone: device.caretaker_phone ?? '',
    rssiThresholdDbm: device.rssi_threshold_dbm ?? -65,
    targetBundleSize: device.target_bundle_size ?? '',
    ipAddress: device.ip_address ?? '',
    port: device.port ?? '',
  };
}

// ใช้ทั้งเพิ่มใหม่และแก้ไข — มี `device` = โหมดแก้ไข (PATCH), ไม่มี = โหมดเพิ่ม (POST + ออก token)
export function DeviceFormDialog({ open, onClose, onCreated, onUpdated, hospitalId, device }) {
  const isEdit = Boolean(device);

  const methods = useForm({
    resolver: zodResolver(DeviceFormSchema),
    defaultValues: EMPTY_DEVICE_FORM,
  });
  const {
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = methods;

  const deviceType = useWatch({ control, name: 'deviceType' });

  useEffect(() => {
    if (open) reset(device ? deviceToForm(device) : EMPTY_DEVICE_FORM);
  }, [open, device, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (isEdit) {
        // ฟิลด์ที่เว้นว่าง = สั่งล้างค่า (null) ให้ backend
        await updateDevice(device.id, {
          deviceType: data.deviceType,
          caretakerName: data.caretakerName || null,
          caretakerPhone: data.caretakerPhone || null,
          rssiThresholdDbm: data.rssiThresholdDbm,
          targetBundleSize: data.targetBundleSize === '' ? null : Number(data.targetBundleSize),
          ipAddress: data.ipAddress || null,
          port: data.port === '' ? null : Number(data.port),
        });
        toast.success('บันทึกการแก้ไขอุปกรณ์แล้ว');
        onUpdated();
      } else {
        const result = await createDevice({
          ...data,
          targetBundleSize: data.targetBundleSize === '' ? undefined : data.targetBundleSize,
          ipAddress: data.ipAddress === '' ? undefined : data.ipAddress,
          port: data.port === '' ? undefined : data.port,
          hospitalId,
        });
        toast.success('เพิ่มอุปกรณ์สำเร็จ');
        onCreated(result.deviceToken);
      }
      reset(EMPTY_DEVICE_FORM);
      onClose();
    } catch (error) {
      toast.error(error?.message || (isEdit ? 'แก้ไขอุปกรณ์ไม่สำเร็จ' : 'เพิ่มอุปกรณ์ไม่สำเร็จ'));
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>{isEdit ? `แก้ไขอุปกรณ์ #${device.id}` : 'เพิ่มอุปกรณ์ใหม่'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Field.Select name="deviceType" label="ประเภทอุปกรณ์">
            {DEVICE_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {DEVICE_TYPE_LABEL[type]}
              </MenuItem>
            ))}
          </Field.Select>
          <Field.Text name="caretakerName" label="ผู้ดูแลอุปกรณ์ (ถ้ามี)" />
          <Field.Text name="caretakerPhone" label="เบอร์โทรผู้ดูแล (ถ้ามี)" />
          <Field.Text
            name="rssiThresholdDbm"
            label="เกณฑ์สัญญาณ RSSI (dBm)"
            type="number"
            helperText="ค่ายิ่งติดลบมาก ยิ่งต้องอยู่ใกล้เครื่องอ่านมากขึ้นถึงจะนับว่าตรวจพบ"
          />
          {deviceType === 'FOLDING_TABLE' && (
            <Field.Text
              name="targetBundleSize"
              label="จำนวนชิ้นต่อมัด (ถ้ามี)"
              type="number"
              helperText="ระบบจะเตือนหากมัดผ้าที่สแกนได้ไม่ครบจำนวนนี้"
            />
          )}
          {deviceType === 'RFID_CHECKPOINT' && (
            <>
              <Field.Text
                name="ipAddress"
                label="IP Address ของเครื่องอ่าน"
                helperText="เช่น 192.168.1.190 — ตั้งค่า static IP ไว้ที่ตัวเครื่องอ่านก่อน"
              />
              <Field.Text name="port" label="Port" type="number" helperText="ปกติคือ 6000" />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {isEdit ? 'บันทึก' : 'เพิ่มอุปกรณ์'}
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
