import { z } from 'zod';

const FABRIC_STATUSES = [
  'WASH',
  'DRY',
  'WEIGHT_COUNT',
  'FOLDING_QC',
  'CENTRAL_STOCK',
  'WARD_CABINET',
  'IN_USE_WARD',
  'HOLD',
  'DECOMMISSIONED',
];

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(150),
    maxWashCycles: z.coerce.number().int().positive().optional(),
  }),
});

export const listCategoriesSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const createLotSchema = z.object({
  body: z.object({
    lotCode: z.string().min(1).max(100),
    purchasedAt: z.string().optional(),
    quantity: z.coerce.number().int().positive(),
  }),
});

export const listLotsSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const listFabricItemsSchema = z.object({
  query: z.object({
    status: z.enum(FABRIC_STATUSES).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    lotId: z.coerce.number().int().positive().optional(),
    epcCode: z.string().optional(),
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const createFabricItemSchema = z.object({
  body: z.object({
    epcCode: z.string().min(1).max(64),
    fabricCategoryId: z.coerce.number().int().positive(),
    fabricLotId: z.coerce.number().int().positive().optional(),
    photoUrl: z.string().max(500).optional(),
  }),
});

export const fabricItemDetailSchema = z.object({
  params: z.object({ epc: z.string().min(1) }),
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const holdDecommissionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    reasonCode: z.string().min(1).max(100),
    photoUrl: z.string().max(500).optional(),
  }),
});
