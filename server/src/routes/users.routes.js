import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as usersController from '../controllers/users.controller.js';
import * as permissionsController from '../controllers/permissions.controller.js';
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  userPermissionsParamsSchema,
  updateUserPermissionsSchema,
} from '../schemas/user.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest(listUsersSchema), usersController.listUsers);
router.post('/', validateRequest(createUserSchema), usersController.createUser);
router.patch('/:id', validateRequest(updateUserSchema), usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

router.get(
  '/:id/permissions',
  validateRequest(userPermissionsParamsSchema),
  permissionsController.getUserPermissions
);
router.put(
  '/:id/permissions',
  validateRequest(updateUserPermissionsSchema),
  permissionsController.updateUserPermissions
);

export default router;
