import { MedicineCategory, ScheduleType } from "@pharmacy-os/types";
import { z } from "zod";

export const medicineFormSchema = z.object({
  name: z.string().min(2),
  genericName: z.string().min(2),
  sku: z.string().optional(),
  category: z.nativeEnum(MedicineCategory),
  manufacturer: z.string().min(2),
  batchNo: z.string().min(1),
  expiryDate: z.string().min(1),
  mfgDate: z.string().min(1),
  mrp: z.coerce.number().positive(),
  purchasePrice: z.coerce.number().nonnegative(),
  gstRate: z.coerce.number().refine((value) => [5, 12, 18].includes(value), "GST must be 5, 12, or 18"),
  hsnCode: z.string().min(4),
  stockQty: z.coerce.number().int().nonnegative(),
  reorderLevel: z.coerce.number().int().nonnegative(),
  scheduleType: z.nativeEnum(ScheduleType),
  barcodeId: z.string().optional(),
  isOnline: z.coerce.boolean(),
  onlinePrice: z.coerce.number().positive().optional().or(z.literal(""))
});
