import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as devicesController from '../controllers/devices.controller.js';
import { createDeviceSchema, listDevicesSchema } from '../schemas/device.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest(listDevicesSchema), devicesController.listDevices);
router.post('/', validateRequest(createDeviceSchema), devicesController.createDevice);

export default router;
