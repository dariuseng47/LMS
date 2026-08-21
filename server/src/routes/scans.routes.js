import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as scansController from '../controllers/scans.controller.js';
import { wardIssueSchema, wardReceiveSchema } from '../schemas/scans.schema.js';

const router = Router();

router.use(authenticate);

router.post('/ward-issue', validateRequest(wardIssueSchema), scansController.wardIssue);
router.post('/ward-receive', validateRequest(wardReceiveSchema), scansController.wardReceive);

export default router;
