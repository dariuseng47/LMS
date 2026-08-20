import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(100),
    password: z.string().min(8).max(200),
    fullName: z.string().min(1).max(150),
    phone: z.string().max(30).optional(),
    role: z.enum(['ADMIN', 'OPERATOR']),
    // ต้องระบุเมื่อ superadmin เป็นคนสร้าง (admin สร้างจะถูกบังคับเป็น hospital ตัวเองเสมอ ไม่สนใจค่านี้)
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    fullName: z.string().min(1).max(150).optional(),
    phone: z.string().max(30).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});
