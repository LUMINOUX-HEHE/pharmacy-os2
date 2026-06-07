import { z } from "zod";

export const distributorSchema = z.object({
  name: z.string().min(2),
  contactPerson: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email(),
  categories: z.array(
    z.enum(["TABLET", "CAPSULE", "SYRUP", "INJECTION", "CREAM", "OINTMENT", "DROPS", "INHALER", "DEVICE", "SUPPLEMENT"])
  ),
  gstin: z.string().min(15).max(15).optional().nullable()
});

export const poSchema = z.object({
  distributorId: z.string().min(1),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        medicineId: z.string().min(1),
        quantity: z.number().int().positive(),
        purchasePrice: z.number().int().nonnegative()
      })
    )
    .min(1)
});
