import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as scansController from '../controllers/scans.controller.js';
import { authenticateDevice } from '../middleware/authenticateDevice.js';
import {
  wardIssueSchema,
  weightGateSchema,
  wardReceiveSchema,
  bundleCheckSchema,
  cabinetAuditSchema,
} from '../schemas/scans.schema.js';

const router = Router();

// device token auth (ไม่ใช่ user JWT) ต้องมาก่อน router.use(authenticate) ด้านล่าง — edge device
// (WEIGHT_GATE/FOLDING_TABLE) ไม่มี user session ของตัวเอง ดู middleware/authenticateDevice.js
router.post(
  '/weight-gate',
  validateRequest(weightGateSchema),
  authenticateDevice,
  scansController.weightGate
);
router.post(
  '/bundle-check',
  validateRequest(bundleCheckSchema),
  authenticateDevice,
  scansController.bundleCheck
);

router.use(authenticate);

router.post('/ward-issue', validateRequest(wardIssueSchema), scansController.wardIssue);
router.post('/ward-receive', validateRequest(wardReceiveSchema), scansController.wardReceive);
router.post('/cabinet-audit', validateRequest(cabinetAuditSchema), scansController.cabinetAudit);

export default router;
