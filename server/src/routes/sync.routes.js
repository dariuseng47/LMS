import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as syncConflictsController from '../controllers/syncConflicts.controller.js';
import { syncBatchSchema, approveConflictSchema } from '../schemas/sync.schema.js';

const router = Router();

router.use(authenticate);

router.post('/batch', validateRequest(syncBatchSchema), syncConflictsController.syncBatch);
router.get('/conflicts', syncConflictsController.listConflicts);
router.post(
  '/conflicts/:id/approve',
  validateRequest(approveConflictSchema),
  syncConflictsController.approveConflict
);

export default router;
