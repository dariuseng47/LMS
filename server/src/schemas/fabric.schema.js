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
    fabricCategoryId: z.coerce.number().int().positive().optional(),
    maxWashCycles: z.coerce.number().int().positive().optional(),
    maxUsageMonths: z.coerce.number().int().positive().optional(),
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
  body: z
    .object({
      epcCode: z.string().min(1).max(64),
      fabricCategoryId: z.coerce.number().int().positive().optional(),
      fabricLotId: z.coerce.number().int().positive().optional(),
      photoUrl: z.string().max(500).optional(),
    })
    // ถ้าไม่ผูกล็อต ต้องระบุหมวดหมู่เอง — ถ้าผูกล็อต จะดึงหมวดหมู่จากล็อตให้อัตโนมัติ
    .refine((data) => data.fabricCategoryId || data.fabricLotId, {
      message: 'ต้องระบุ fabricCategoryId หรือ fabricLotId อย่างน้อยหนึ่งอย่าง',
      path: ['fabricCategoryId'],
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
