import { z } from 'zod';

export const locationByEpcSchema = z.object({
  params: z.object({ epc: z.string().min(1) }),
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const processStatusSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

// ค้นผ้าหลายชิ้นพร้อมกัน (หน้าสแกนค้นหาผ้าแบบ bulk บน handheld)
export const lookupByEpcsSchema = z.object({
  body: z.object({
    epcCodes: z.array(z.string().min(1).max(64)).min(1).max(500),
  }),
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});
