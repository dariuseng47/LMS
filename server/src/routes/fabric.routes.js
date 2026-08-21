import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as categoriesController from '../controllers/fabricCategories.controller.js';
import * as fabricItemsController from '../controllers/fabricItems.controller.js';
import * as fabricLotsController from '../controllers/fabricLots.controller.js';
import {
  createCategorySchema,
  createFabricItemSchema,
  createLotSchema,
  fabricItemDetailSchema,
  holdDecommissionSchema,
  listCategoriesSchema,
  listFabricItemsSchema,
  listLotsSchema,
} from '../schemas/fabric.schema.js';

const router = Router();

router.use(authenticate);

// Categories
router.get('/fabric-categories', validateRequest(listCategoriesSchema), categoriesController.listCategories);
router.post(
  '/fabric-categories',
  validateRequest(createCategorySchema),
  categoriesController.createCategory
);

// Lots
router.get('/fabric-lots', validateRequest(listLotsSchema), fabricLotsController.listLots);
router.post('/fabric-lots', validateRequest(createLotSchema), fabricLotsController.createLot);

// Items
router.get('/fabric-items', validateRequest(listFabricItemsSchema), fabricItemsController.listFabricItems);
router.post(
  '/fabric-items',
  validateRequest(createFabricItemSchema),
  fabricItemsController.createFabricItem
);
router.get(
  '/fabric-items/:epc',
  validateRequest(fabricItemDetailSchema),
  fabricItemsController.getFabricItemDetail
);
router.post(
  '/fabric-items/:id/hold',
  validateRequest(holdDecommissionSchema),
  fabricItemsController.holdFabricItem
);
router.post(
  '/fabric-items/:id/decommission',
  validateRequest(holdDecommissionSchema),
  fabricItemsController.decommissionFabricItem
);

export default router;
