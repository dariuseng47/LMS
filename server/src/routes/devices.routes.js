import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as devicesController from '../controllers/devices.controller.js';
import { authenticateDevice } from '../middleware/authenticateDevice.js';
import {
  createDeviceSchema,
  listDevicesSchema,
  updateDeviceSchema,
  heartbeatParamsSchema,
} from '../schemas/device.schema.js';

const router = Router();

// device token auth (ไม่ใช่ user JWT) ต้องมาก่อน router.use(authenticate) ด้านล่าง
// เพราะ edge device ไม่มี user session ของตัวเอง — ดู middleware/authenticateDevice.js
router.post(
  '/:id/heartbeat',
  validateRequest(heartbeatParamsSchema),
  authenticateDevice,
  devicesController.receiveHeartbeat
);

router.use(authenticate);

router.get('/', validateRequest(listDevicesSchema), devicesController.listDevices);
router.post('/', validateRequest(createDeviceSchema), devicesController.createDevice);
router.patch('/:id', validateRequest(updateDeviceSchema), devicesController.updateDevice);
router.post(
  '/:id/rotate-token',
  validateRequest(heartbeatParamsSchema),
  devicesController.rotateDeviceToken
);

export default router;
