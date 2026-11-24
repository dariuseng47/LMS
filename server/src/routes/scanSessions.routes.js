import { Router } from 'express';

import { authenticate, requireAnyPermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as scanSessionsController from '../controllers/scanSessions.controller.js';
import {
  confirmScanSessionSchema,
  listScanSessionsSchema,
  reportScanSessionSchema,
  scanSessionParamsSchema,
  triggerScanSessionSchema,
} from '../schemas/scanSession.schema.js';

const router = Router();

router.use(authenticate);

// ส่งผลแล้วลงทะเบียนผ้าทันที (ไม่มีแอดมินอนุมัติ) จึงต้องมีสิทธิ์ลงทะเบียนผ้าตั้งแต่ตอนเริ่มรอบ
const canRegister = requireAnyPermission('web.fabric.register.edit', 'handheld.inventory.edit');

router.post(
  '/',
  canRegister,
  validateRequest(triggerScanSessionSchema),
  scanSessionsController.triggerScanSession
);
router.get('/', validateRequest(listScanSessionsSchema), scanSessionsController.listScanSessions);
router.get('/:id', validateRequest(scanSessionParamsSchema), scanSessionsController.getScanSession);
router.post(
  '/:id/report',
  canRegister,
  validateRequest(reportScanSessionSchema),
  scanSessionsController.reportScanSession
);
router.post(
  '/:id/confirm',
  canRegister,
  validateRequest(confirmScanSessionSchema),
  scanSessionsController.confirmScanSession
);
router.post(
  '/:id/cancel',
  canRegister,
  validateRequest(scanSessionParamsSchema),
  scanSessionsController.cancelScanSession
);

export default router;
