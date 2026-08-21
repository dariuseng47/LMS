import { z } from 'zod';

const DEVICE_TYPES = ['WEIGHT_GATE', 'FOLDING_TABLE', 'WARD_KIOSK', 'HANDHELD'];

export const listDevicesSchema = z.object({
  query: z.object({
    deviceType: z.enum(DEVICE_TYPES).optional(),
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const createDeviceSchema = z.object({
  body: z.object({
    deviceType: z.enum(DEVICE_TYPES),
    caretakerName: z.string().max(150).optional(),
    caretakerPhone: z.string().max(30).optional(),
    rssiThresholdDbm: z.coerce.number().int().optional(),
  }),
});

export const updateDeviceCaretakerSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    caretakerName: z.string().max(150).optional(),
    caretakerPhone: z.string().max(30).optional(),
  }),
});
