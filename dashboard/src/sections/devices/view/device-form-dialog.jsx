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

import {
  SCAN_POINTS,
  DEVICE_TYPES,
  SCAN_POINT_LABEL,
  DEVICE_TYPE_LABEL,
  SCAN_POINT_DEVICE_TYPE,
} from '../device-constants';

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
  scanProfile: zod.enum(['VERY_FAST', 'FAST', 'NORMAL', 'THOROUGH', 'CUSTOM']),
  // ใช้เฉพาะ scanProfile = CUSTOM (เว้นว่าง = ใช้ค่าเริ่มต้นของระบบ)
  scanRoundMs: zod.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    zod.coerce.number({ message: 'กรอกเป็นตัวเลข' }).int().min(300).max(25500, 'ช่วง 300–25500 ms').optional()
  ),
  scanStableRounds: zod.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    zod.coerce.number({ message: 'กรอกเป็นตัวเลข' }).int().min(1).max(10, 'ช่วง 1–10 รอบ').optional()
  ),
  scanMaxSec: zod.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    zod.coerce.number({ message: 'กรอกเป็นตัวเลข' }).int().min(1).max(60, 'ช่วง 1–60 วินาที').optional()
  ),
  scanPowerDbm: zod.preprocess(
    (val) => (val === '' ? undefined : val),
    zod.coerce.number().int().min(0).max(30).optional()
  ),
  scanMinRssi: zod.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    zod.coerce.number({ message: 'กรอกเป็นตัวเลข' }).int().min(0).max(255, 'ช่วง 0–255').optional()
  ),
  defaultScanPoints: zod.array(zod.string()).optional(),
});

// ms/เสา = InventoryScanTime ที่ส่งเข้าเครื่อง (เครื่อง 4 พอร์ตอ่านทีละเสาต่อรอบ) — ต้องตรงกับ
// SCAN_PROFILES ใน server/src/controllers/rfidReader.controller.js
const SCAN_PROFILE_OPTIONS = [
  { value: 'VERY_FAST', label: 'เร็วมาก — 300ms/เสา สลับเสารัว เหมาะโหมดอ่านอัตโนมัติ' },
  { value: 'FAST', label: 'เร็ว — 500ms/เสา เหมาะของวางนิ่ง จำนวนน้อย' },
  { value: 'NORMAL', label: 'ปกติ — 1 วินาที/เสา (ค่าเริ่มต้น)' },
  { value: 'THOROUGH', label: 'ละเอียด — 2 วินาที/เสา เหมาะผ้าจำนวนมาก/เข็นรถเข็นผ่านช้าๆ' },
  { value: 'CUSTOM', label: 'กำหนดเอง — กรอกเวลาเอง' },
];

const EMPTY_DEVICE_FORM = {
  deviceType: 'WEIGHT_GATE',
  caretakerName: '',
  caretakerPhone: '',
  rssiThresholdDbm: -65,
  targetBundleSize: '',
  ipAddress: '',
  port: '',
  scanProfile: 'NORMAL',
  scanPowerDbm: '',
  scanRoundMs: '',
  scanStableRounds: '',
  scanMaxSec: '',
  scanMinRssi: '',
  defaultScanPoints: [],
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
    scanProfile: device.scan_profile ?? 'NORMAL',
    scanPowerDbm: device.scan_power_dbm ?? '',
    scanRoundMs: device.scan_round_ms ?? '',
    scanStableRounds: device.scan_stable_rounds ?? '',
    scanMaxSec: device.scan_max_ms ? device.scan_max_ms / 1000 : '',
    scanMinRssi: device.scan_min_rssi ?? '',
    defaultScanPoints: device.default_scan_points ?? [],
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
  const scanProfile = useWatch({ control, name: 'scanProfile' });

  // จุดสแกนที่อุปกรณ์ประเภทนี้ตั้งเป็น default ได้
  const eligibleScanPoints = SCAN_POINTS.filter(
    (point) => SCAN_POINT_DEVICE_TYPE[point] === deviceType
  );

  useEffect(() => {
    if (open) reset(device ? deviceToForm(device) : EMPTY_DEVICE_FORM);
  }, [open, device, reset]);

  const onSubmit = handleSubmit(async (data) => {
    // ค่ากำหนดเอง: zod แปลงช่องว่างเป็น undefined แล้ว -> ส่ง null = ล้างค่า (เฉพาะตอนแก้ไข)
    const blank = isEdit ? null : undefined;
    const customTiming = {
      scanRoundMs: data.scanRoundMs ?? blank,
      scanStableRounds: data.scanStableRounds ?? blank,
      scanMaxMs: data.scanMaxSec ? Math.round(data.scanMaxSec * 1000) : blank,
      scanMinRssi: data.scanMinRssi ?? blank,
    };
    // เก็บเฉพาะจุดที่ตรงกับประเภทอุปกรณ์ปัจจุบัน (เผื่อเปลี่ยนประเภทจนบางจุดใช้ไม่ได้แล้ว)
    const defaultScanPoints = (data.defaultScanPoints ?? []).filter(
      (point) => SCAN_POINT_DEVICE_TYPE[point] === data.deviceType
    );
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
          scanProfile: data.scanProfile,
          scanPowerDbm: data.scanPowerDbm === '' ? null : Number(data.scanPowerDbm),
          ...customTiming,
          defaultScanPoints,
        });
        toast.success('บันทึกการแก้ไขอุปกรณ์แล้ว');
        onUpdated();
      } else {
        const { scanMaxSec, ...rest } = data;
        const result = await createDevice({
          ...rest,
          ...customTiming,
          targetBundleSize: data.targetBundleSize === '' ? undefined : data.targetBundleSize,
          ipAddress: data.ipAddress === '' ? undefined : data.ipAddress,
          port: data.port === '' ? undefined : data.port,
          scanPowerDbm: data.scanPowerDbm === '' ? undefined : data.scanPowerDbm,
          defaultScanPoints: defaultScanPoints.length ? defaultScanPoints : undefined,
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
          {eligibleScanPoints.length > 0 && (
            <Field.MultiSelect
              chip
              checkbox
              name="defaultScanPoints"
              label="ตั้งเป็นเครื่องเริ่มต้นของจุด (เลือกได้หลายจุด)"
              helperText="หน้างานของจุดที่เลือกจะเลือกอุปกรณ์นี้ให้อัตโนมัติ — 1 จุดมีเครื่องเริ่มต้นได้เครื่องเดียว ผู้ใช้เปลี่ยนเองได้"
              options={eligibleScanPoints.map((point) => ({
                value: point,
                label: SCAN_POINT_LABEL[point],
              }))}
            />
          )}
          <Field.Text name="caretakerName" label="ผู้ดูแลอุปกรณ์ (ถ้ามี)" />
          <Field.Text name="caretakerPhone" label="เบอร์โทรผู้ดูแล (ถ้ามี)" />
          <Field.Text
            name="rssiThresholdDbm"
            label="เกณฑ์สัญญาณ RSSI (dBm)"
            type="number"
            helperText="ใช้สำหรับแจ้งเตือนสัญญาณอ่อนในหน้าแจ้งเตือน (ไม่ได้กรองผลสแกน — คุมระยะอ่านใช้ช่อง RSSI ขั้นต่ำด้านล่าง)"
          />
          {deviceType === 'FOLDING_TABLE' && (
            <Field.Text
              name="targetBundleSize"
              label="จำนวนชิ้นต่อมัด (ถ้ามี)"
              type="number"
              helperText="ระบบจะเตือนหากมัดผ้าที่สแกนได้ไม่ครบจำนวนนี้"
            />
          )}
          {['RFID_CHECKPOINT', 'WEIGHT_GATE'].includes(deviceType) && (
            <>
              <Field.Text
                name="ipAddress"
                label="IP Address ของเครื่องอ่าน"
                helperText="เช่น 192.168.1.190 — ตั้งค่า static IP ไว้ที่ตัวเครื่องอ่านก่อน (server ต่อเข้าไปอ่านแท็กเอง)"
              />
              <Field.Text name="port" label="Port" type="number" helperText="ปกติคือ 6000" />
              <Field.Select name="scanProfile" label="ความเร็วการสแกน">
                {SCAN_PROFILE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Field.Select>
              {scanProfile === 'CUSTOM' && (
                <>
                  <Field.Text
                    name="scanRoundMs"
                    label="เวลาอ่านต่อเสา (ms)"
                    type="number"
                    inputProps={{ min: 300, max: 25500, step: 100 }}
                    helperText="300–25500 (ปัดทีละ 100) · ยิ่งน้อย = สลับเสาเร็ว อ่านรัว · ผ้าเยอะมากควรเพิ่ม · เว้นว่าง = 500"
                  />
                  <Field.Text
                    name="scanStableRounds"
                    label="ไม่เจอผ้าใหม่กี่รอบถึงจบ"
                    type="number"
                    inputProps={{ min: 1, max: 10 }}
                    helperText="1–10 รอบ (นับครบทุกเสา 1 รอบ) · มากขึ้น = อ่านครบขึ้นแต่นานขึ้น · เว้นว่าง = 1"
                  />
                  <Field.Text
                    name="scanMaxSec"
                    label="เวลาสแกนสูงสุดต่อครั้ง (วินาที)"
                    type="number"
                    inputProps={{ min: 1, max: 60 }}
                    helperText="1–60 · ครบเวลาแล้วหยุดทันทีแม้ยังเจอผ้าใหม่ · เว้นว่าง = 15"
                  />
                </>
              )}
              <Field.Text
                name="scanPowerDbm"
                label="ความแรงสัญญาณ RF (dBm)"
                type="number"
                inputProps={{ min: 0, max: 30 }}
                helperText="0–30 (รุ่นเล็กรับแค่ 0–18) · ยิ่งสูง = อ่านไกลขึ้น · เว้นว่าง = ใช้ค่าในตัวเครื่อง · เช็คว่าเครื่องรับค่าจริงด้วย test-power.bat ใน Reader Agent"
              />
              <Field.Text
                name="scanMinRssi"
                label="RSSI ขั้นต่ำ — กรองแท็กที่อยู่ไกล"
                type="number"
                inputProps={{ min: 0, max: 255 }}
                helperText="0–255 ค่าดิบจากเครื่อง (ยิ่งมาก = ยิ่งใกล้/แรง) แท็กที่ต่ำกว่านี้ถูกตัดทิ้ง · ดูค่าจริงได้จากหน้าต่าง Reader Agent (RSSI ต่ำสุด–สูงสุด) · เว้นว่าง = ไม่กรอง"
              />
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
