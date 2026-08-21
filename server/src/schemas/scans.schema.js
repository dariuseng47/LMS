import { z } from 'zod';

// เพิ่มเข้ามาเพื่อรองรับ nativeapp/ (มือถือ operator) — ดู docs/api-spec.md
// ยังไม่รองรับ weight-gate/bundle-check (ต้อง device-token auth แยก ตามที่ scanSessions.controller.js
// คอมเมนต์ไว้ว่ายังไม่มี handheld app จริง) เฉพาะ ward-issue/ward-receive ที่ operator ใช้งานตรงจากมือถือได้

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
