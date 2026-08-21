import { z } from 'zod';

// เพิ่มเข้ามาเพื่อรองรับ nativeapp/ (มือถือ operator) — ดู docs/api-spec.md
// weight-gate/bundle-check (device token, ดู middleware/authenticateDevice.js) อยู่ท้ายไฟล์นี้

export const wardIssueSchema = z.object({
  body: z.object({
    epcCode: z.string().min(1).max(64),
    cabinetId: z.coerce.number().int().positive(),
  }),
});

export const wardReceiveSchema = z.object({
  body: z.object({
    epcCode: z.string().min(1).max(64),
  }),
});

export const weightGateSchema = z.object({
  body: z
    .object({
      epcCodes: z.array(z.string().min(1).max(64)).min(1).max(200),
      weightKg: z.coerce.number().nonnegative().optional(),
      sensorError: z.boolean().optional().default(false),
    })
    .refine((data) => data.sensorError || data.weightKg !== undefined, {
      message: 'ต้องระบุ weightKg เว้นแต่ sensorError = true',
      path: ['weightKg'],
    }),
});
