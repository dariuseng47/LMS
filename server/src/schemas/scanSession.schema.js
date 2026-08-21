import { z } from 'zod';

export const triggerScanSessionSchema = z.object({
  body: z.object({
    fabricLotId: z.coerce.number().int().positive(),
    deviceId: z.coerce.number().int().positive(),
  }),
});

export const scanSessionParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const reportScanSessionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    epcCodes: z.array(z.string().min(1).max(64)).min(1),
  }),
});

export const confirmScanSessionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    // แอดมินตัด EPC ที่ไม่ต้องการออกได้ก่อน confirm (default = ยืนยันทั้งหมดที่ scan เจอ)
    epcCodes: z.array(z.string().min(1).max(64)).min(1).optional(),
  }),
});
