import { z } from "zod";

export const statusUpdateSchema = z.object({
  status: z.enum(["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]),
  note: z.string().min(2).optional()
});

export const assignDriverSchema = z.object({
  driverId: z.string().min(1)
});

export const orderQuerySchema = z.object({
  status: z.enum(["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]).optional(),
  date: z.enum(["today"]).optional(),
  view: z.enum(["kanban", "list"]).optional()
});
