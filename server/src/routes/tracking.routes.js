import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as trackingController from '../controllers/tracking.controller.js';
import { processStatusSchema, locationByEpcSchema, lookupByEpcsSchema } from '../schemas/tracking.schema.js';

const router = Router();

router.use(authenticate);

router.get('/location/:epc', validateRequest(locationByEpcSchema), trackingController.getLocationByEpc);
router.post('/lookup', validateRequest(lookupByEpcsSchema), trackingController.lookupByEpcs);
router.get(
  '/process-status',
  requirePermission('web.tracking.view'),
  validateRequest(processStatusSchema),
  trackingController.getProcessStatus
);

export default router;
