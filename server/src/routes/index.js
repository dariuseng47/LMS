import { Router } from 'express';

import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import scansRoutes from './scans.routes.js';
import fabricRoutes from './fabric.routes.js';
import devicesRoutes from './devices.routes.js';
import cabinetsRoutes from './cabinets.routes.js';
import trackingRoutes from './tracking.routes.js';
import hospitalsRoutes from './hospitals.routes.js';
import departmentsRoutes from './departments.routes.js';
import scanSessionsRoutes from './scanSessions.routes.js';
import auditLogsRoutes from './auditLogs.routes.js';
import statusTimeoutsRoutes from './statusTimeouts.routes.js';
import alertsRoutes from './alerts.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/hospitals', hospitalsRoutes);
router.use('/users', usersRoutes);
router.use('/', fabricRoutes);
router.use('/devices', devicesRoutes);
router.use('/scan-sessions', scanSessionsRoutes);
router.use('/scans', scansRoutes);
router.use('/tracking', trackingRoutes);
router.use('/departments', departmentsRoutes);
router.use('/cabinets', cabinetsRoutes);
router.use('/audit-logs', auditLogsRoutes);
router.use('/status-timeout-settings', statusTimeoutsRoutes);
router.use('/alerts', alertsRoutes);

// TODO: mount routes อื่นตาม docs/api-spec.md ต่อไป
// (weight-gate/bundle-check scans ต้อง device-token auth แยก, transfers, sync)

export default router;
