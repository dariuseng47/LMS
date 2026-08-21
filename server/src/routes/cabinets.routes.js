import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as cabinetsController from '../controllers/cabinets.controller.js';
import {
  cabinetParamsSchema,
  createCabinetSchema,
  listCabinetsSchema,
  updateCabinetSchema,
  upsertParLevelsSchema,
} from '../schemas/cabinet.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest(listCabinetsSchema), cabinetsController.listCabinets);
router.post('/', validateRequest(createCabinetSchema), cabinetsController.createCabinet);
router.patch('/:id', validateRequest(updateCabinetSchema), cabinetsController.updateCabinet);
router.delete('/:id', validateRequest(cabinetParamsSchema), cabinetsController.deleteCabinet);
router.get(
  '/:id/par-levels',
  validateRequest(cabinetParamsSchema),
  cabinetsController.getParLevels
);
router.put(
  '/:id/par-levels',
  validateRequest(upsertParLevelsSchema),
  cabinetsController.upsertParLevels
);

export default router;
