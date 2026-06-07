import { z } from "zod";

export const driverSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  vehicle: z.string().min(2),
  isActive: z.boolean().default(true)
});
