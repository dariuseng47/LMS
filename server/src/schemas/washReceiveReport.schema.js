import { z } from 'zod';

export const getWashReceiveReportSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
    period: z.enum(['day', 'month', 'year']).optional().default('day'),
  }),
});
