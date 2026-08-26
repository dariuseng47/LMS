import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getWashReceiveReport } from '../controllers/washReceiveReport.controller.js';
import { getWashReceiveReportSchema } from '../schemas/washReceiveReport.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest(getWashReceiveReportSchema), getWashReceiveReport);

export default router;
