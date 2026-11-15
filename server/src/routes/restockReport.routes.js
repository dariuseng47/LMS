import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getRestockReport } from '../controllers/restockReport.controller.js';
import { getRestockFillHistory } from '../controllers/restockFillHistory.controller.js';
import { getParAnalysis } from '../controllers/parAnalysis.controller.js';
import { getRewashAnalysis } from '../controllers/rewashAnalysis.controller.js';
import {
  getRestockReportSchema,
  getFillHistorySchema,
  getParAnalysisSchema,
  getRewashAnalysisSchema,
} from '../schemas/restockReport.schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('web.operations.restock_report.view'),
  validateRequest(getRestockReportSchema),
  getRestockReport
);

router.get(
  '/fill-history',
  requirePermission('web.operations.restock_report.view'),
  validateRequest(getFillHistorySchema),
  getRestockFillHistory
);

// สถิติผ้าเกิน/ขาด Par + Par แนะนำ (แท็บ "วิเคราะห์ Par" และ dialog ตั้ง Par ของตู้)
router.get(
  '/par-analysis',
  requirePermission('web.operations.restock_report.view'),
  validateRequest(getParAnalysisSchema),
  getParAnalysis
);

// ประวัติ & สถิติผ้าส่งซักใหม่ (แท็บ "ประวัติผ้าส่งซักใหม่") — มาจากแผนก/สถานะไหน, ประเภท, เหตุผล, ส่งซ้ำ
router.get(
  '/rewash-analysis',
  requirePermission('web.operations.restock_report.view'),
  validateRequest(getRewashAnalysisSchema),
  getRewashAnalysis
);

export default router;
