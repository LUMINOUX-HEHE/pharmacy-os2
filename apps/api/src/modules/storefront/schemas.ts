import { z } from "zod";

export const storefrontOrderSchema = z.object({
  phone: z.string().regex(/^\+?91?[6-9]\d{9}$/),
  otp: z.string().length(6),
  customerName: z.string().min(2),
  address: z.string().min(5),
  prescriptionUrl: z.string().url().optional().nullable(),
  paymentMode: z.enum(["CASH", "UPI", "CARD"]),
  items: z.array(z.object({ medicineId: z.string(), quantity: z.number().int().positive() })).min(1)
});
