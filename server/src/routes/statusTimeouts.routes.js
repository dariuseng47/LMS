import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as statusTimeoutsController from '../controllers/statusTimeouts.controller.js';
import {
  listStatusTimeoutsSchema,
  upsertStatusTimeoutsSchema,
} from '../schemas/statusTimeout.schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validateRequest(listStatusTimeoutsSchema),
  statusTimeoutsController.listStatusTimeouts
);
router.put(
  '/',
  validateRequest(upsertStatusTimeoutsSchema),
  statusTimeoutsController.upsertStatusTimeouts
);

export default router;
