import { z } from "zod";

export const reminderSchema = z.object({
  customerId: z.string().min(1),
  medicineId: z.string().min(1),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]),
  nextSendAt: z.coerce.date().optional(),
  isActive: z.boolean().default(true)
});
