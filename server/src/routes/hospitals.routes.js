import { Router } from 'express';

import { authenticate, requireRole, requireAnyPermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createHospitalSchema,
  hospitalParamsSchema,
  dashboardSummarySchema,
  updateHospitalSchema,
} from '../schemas/hospital.schema.js';
import * as hospitalsController from '../controllers/hospitals.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('SUPERADMIN'), hospitalsController.listHospitals);
router.get('/summary', requireRole('SUPERADMIN'), hospitalsController.getHospitalsSummary);
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
router.delete(
  '/:id',
  requireRole('SUPERADMIN'),
  validateRequest(hospitalParamsSchema),
  hospitalsController.deleteHospital
);
router.get(
  '/:id/dashboard-summary',
  // ข้อมูลชุดเดียวกันใช้ 2 หน้า: แดชบอร์ดโรงพยาบาล (หน้าแรก) และโปรไฟล์โรงพยาบาล
  requireAnyPermission('web.dashboard.overview.view', 'web.dashboard.hospital_profile.view'),
  validateRequest(dashboardSummarySchema),
  hospitalsController.getDashboardSummary
);

export default router;
