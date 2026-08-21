import { Router } from 'express';

import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import fabricRoutes from './fabric.routes.js';
import hospitalsRoutes from './hospitals.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/hospitals', hospitalsRoutes);
router.use('/users', usersRoutes);
router.use('/', fabricRoutes);

// TODO: mount routes อื่นตาม docs/api-spec.md ต่อไป
// (scans, devices, transfers, sync, alerts, audit-logs)

export default router;
