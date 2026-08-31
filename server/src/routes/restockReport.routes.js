import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getRestockReport } from '../controllers/restockReport.controller.js';
import { getRestockReportSchema } from '../schemas/restockReport.schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('web.operations.restock_report.view'),
  validateRequest(getRestockReportSchema),
  getRestockReport
);

export default router;
