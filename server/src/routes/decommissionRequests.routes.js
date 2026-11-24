import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as decommissionRequestsController from '../controllers/decommissionRequests.controller.js';
import {
  listDecommissionRequestsSchema,
  decommissionRequestParamsSchema,
  rejectDecommissionRequestSchema,
} from '../schemas/decommissionRequests.schema.js';

const router = Router();

router.use(authenticate);

// อนุมัติ/ปฏิเสธผูกกับสิทธิ์เมนู "รายการพัก & ชำรุด" บนเว็บ — และยังเป็นงานของ admin/superadmin เท่านั้น
// (controller เช็ค role อีกชั้น) เพราะ operator ที่มีสิทธิ์แก้ไขเมนูนี้คือ "ผู้ส่งคำขอ"
router.get(
  '/',
  requirePermission('web.fabric.hold.view'),
  validateRequest(listDecommissionRequestsSchema),
  decommissionRequestsController.listDecommissionRequests
);
router.post(
  '/:id/approve',
  requirePermission('web.fabric.hold.edit'),
  validateRequest(decommissionRequestParamsSchema),
  decommissionRequestsController.approveDecommissionRequest
);
router.post(
  '/:id/reject',
  requirePermission('web.fabric.hold.edit'),
  validateRequest(rejectDecommissionRequestSchema),
  decommissionRequestsController.rejectDecommissionRequest
);

export default router;
