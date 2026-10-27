import { Router } from 'express';

import { authenticate, requirePermission, requireAnyPermission } from '../middleware/authenticate.js';
import { uploadHoldPhoto } from '../middleware/upload.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as groupsController from '../controllers/fabricGroups.controller.js';
import * as categoriesController from '../controllers/fabricCategories.controller.js';
import * as fabricItemsController from '../controllers/fabricItems.controller.js';
import * as fabricLotsController from '../controllers/fabricLots.controller.js';
import {
  createCategorySchema,
  createGroupSchema,
  updateGroupSchema,
  deleteByIdSchema,
  createFabricItemSchema,
  createLotSchema,
  fabricItemDetailSchema,
  holdDecommissionSchema,
  listCategoriesSchema,
  listFabricItemsSchema,
  listLotsSchema,
  updateCategorySchema,
  bulkCreateFabricItemsSchema,
  checkEpcsSchema,
} from '../schemas/fabric.schema.js';

const router = Router();

router.use(authenticate);

// Groups (หมวดหมู่ผ้า เช่น ผ้าเสตอไลส์ / ผ้าสามัญ)
router.get('/fabric-groups', validateRequest(listCategoriesSchema), groupsController.listGroups);
router.post(
  '/fabric-groups',
  requirePermission('web.fabric.register.edit'),
  validateRequest(createGroupSchema),
  groupsController.createGroup
);
router.patch(
  '/fabric-groups/:id',
  requirePermission('web.fabric.register.edit'),
  validateRequest(updateGroupSchema),
  groupsController.updateGroup
);
router.delete(
  '/fabric-groups/:id',
  requirePermission('web.fabric.register.edit'),
  validateRequest(deleteByIdSchema),
  groupsController.deleteGroup
);

// Categories (ประเภทผ้า เช่น ชุดผ่าตัด / ผ้าปูเตียง — สังกัดหมวดหมู่ผ้า)
router.get('/fabric-categories', validateRequest(listCategoriesSchema), categoriesController.listCategories);
router.post(
  '/fabric-categories',
  requirePermission('web.fabric.register.edit'),
  validateRequest(createCategorySchema),
  categoriesController.createCategory
);
router.patch(
  '/fabric-categories/:id',
  requirePermission('web.fabric.register.edit'),
  validateRequest(updateCategorySchema),
  categoriesController.updateCategory
);
router.delete(
  '/fabric-categories/:id',
  requirePermission('web.fabric.register.edit'),
  validateRequest(deleteByIdSchema),
  categoriesController.deleteCategory
);

// Lots — ลงทะเบียนล็อต: เว็บ (web.fabric.register.edit) หรือ handheld (handheld.inventory.edit)
router.get('/fabric-lots', validateRequest(listLotsSchema), fabricLotsController.listLots);
router.post(
  '/fabric-lots',
  requireAnyPermission('web.fabric.register.edit', 'handheld.inventory.edit'),
  validateRequest(createLotSchema),
  fabricLotsController.createLot
);

// Items
router.get('/fabric-items', validateRequest(listFabricItemsSchema), fabricItemsController.listFabricItems);
router.post(
  '/fabric-items',
  requireAnyPermission('web.fabric.register.edit', 'handheld.inventory.edit'),
  validateRequest(createFabricItemSchema),
  fabricItemsController.createFabricItem
);
router.post(
  '/fabric-items/bulk',
  requireAnyPermission('web.fabric.register.edit', 'handheld.inventory.edit'),
  validateRequest(bulkCreateFabricItemsSchema),
  fabricItemsController.bulkCreateFabricItems
);
router.post(
  '/fabric-items/check-epcs',
  requireAnyPermission('web.fabric.register.edit', 'handheld.inventory.edit'),
  validateRequest(checkEpcsSchema),
  fabricItemsController.checkEpcs
);
router.get(
  '/fabric-items/:epc',
  validateRequest(fabricItemDetailSchema),
  fabricItemsController.getFabricItemDetail
);
// uploadHoldPhoto ต้องรันก่อน validateRequest เสมอ — เป็นตัว parse multipart/form-data
// (multer) ให้ text field (reasonCode) เข้า req.body ก่อน validateRequest จะอ่านค่าได้
router.post(
  '/fabric-items/:id/hold',
  requireAnyPermission('web.fabric.hold.edit', 'handheld.hold.edit'),
  uploadHoldPhoto,
  validateRequest(holdDecommissionSchema),
  fabricItemsController.holdFabricItem
);
router.post(
  '/fabric-items/:id/decommission',
  requireAnyPermission('web.fabric.hold.edit', 'handheld.hold.edit'),
  uploadHoldPhoto,
  validateRequest(holdDecommissionSchema),
  fabricItemsController.decommissionFabricItem
);

export default router;
