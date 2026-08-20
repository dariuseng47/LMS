import { Router } from 'express';

import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createHospitalSchema,
  dashboardSummarySchema,
  updateHospitalSchema,
} from '../schemas/hospital.schema.js';
import * as hospitalsController from '../controllers/hospitals.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('SUPERADMIN'), hospitalsController.listHospitals);
router.post(
  '/',
  requireRole('SUPERADMIN'),
  validateRequest(createHospitalSchema),
  hospitalsController.createHospital
);
router.patch(
  '/:id',
  requireRole('SUPERADMIN'),
  validateRequest(updateHospitalSchema),
  hospitalsController.updateHospital
);
router.get(
  '/:id/dashboard-summary',
  requireRole('SUPERADMIN', 'ADMIN'),
  validateRequest(dashboardSummarySchema),
  hospitalsController.getDashboardSummary
);

export default router;
