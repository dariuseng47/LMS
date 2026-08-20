import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createUserSchema, listUsersSchema, updateUserSchema } from '../schemas/user.schema.js';
import * as usersController from '../controllers/users.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest(listUsersSchema), usersController.listUsers);
router.post('/', validateRequest(createUserSchema), usersController.createUser);
router.patch('/:id', validateRequest(updateUserSchema), usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

export default router;
