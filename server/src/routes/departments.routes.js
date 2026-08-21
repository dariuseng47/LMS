import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as departmentsController from '../controllers/departments.controller.js';
import {
  createDepartmentSchema,
  departmentParamsSchema,
  listDepartmentsSchema,
  updateDepartmentSchema,
} from '../schemas/department.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest(listDepartmentsSchema), departmentsController.listDepartments);
router.post('/', validateRequest(createDepartmentSchema), departmentsController.createDepartment);
router.patch(
  '/:id',
  validateRequest(updateDepartmentSchema),
  departmentsController.updateDepartment
);
router.delete(
  '/:id',
  validateRequest(departmentParamsSchema),
  departmentsController.deleteDepartment
);

export default router;
