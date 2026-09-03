import { z } from 'zod';

export const getRestockCartPlanSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
    // เผื่อผิดพลาด (%) ที่บวกเพิ่มจากยอดขาด — default 10 (ดู restockCartPlan.controller.js)
    bufferPct: z.coerce.number().min(0).max(100).optional(),
  }),
});
