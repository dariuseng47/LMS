import { Router } from 'express';

import authRoutes from './auth.routes.js';

const router = Router();

router.use('/auth', authRoutes);

// TODO: mount routes อื่นตาม docs/api-spec.md ต่อไป
// (hospitals, users, fabric-items, scans, devices, transfers, sync, alerts, audit-logs)

export default router;
