import { z } from "zod";

export const medicineSchema = z.object({
  name: z.string().min(2),
  genericName: z.string().min(2),
  sku: z.string().min(2).optional(),
  category: z.enum([
    "TABLET",
    "CAPSULE",
    "SYRUP",
    "INJECTION",
    "CREAM",
    "OINTMENT",
    "DROPS",
    "INHALER",
    "DEVICE",
    "SUPPLEMENT"
  ]),
  manufacturer: z.string().min(2),
  batchNo: z.string().min(1),
  expiryDate: z.coerce.date(),
  mfgDate: z.coerce.date(),
  mrp: z.number().int().positive(),
  purchasePrice: z.number().int().nonnegative(),
  gstRate: z.union([z.literal(5), z.literal(12), z.literal(18)]),
  hsnCode: z.string().min(4),
  stockQty: z.number().int().nonnegative(),
  reorderLevel: z.number().int().nonnegative(),
  scheduleType: z.enum(["GENERAL", "H", "H1", "X"]).default("GENERAL"),
  barcodeId: z.string().optional().nullable(),
  isOnline: z.boolean().default(true),
  onlinePrice: z.number().int().positive().optional().nullable()
});

export const updateMedicineSchema = medicineSchema.partial();

export const inventoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  stockStatus: z.enum(["LOW", "OUT", "AVAILABLE", "in_stock", "low_stock", "out_of_stock"]).optional(),
  expiryStatus: z.enum(["7", "30", "60", "expired", "expiring_soon", "within_7", "within_30", "within_60", "valid"]).optional(),
  sort: z.enum(["name", "stock", "expiry", "price", "stockQty", "expiryDate", "mrp"]).default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  isOnline: z.enum(["true", "false", "all"]).optional()
});
