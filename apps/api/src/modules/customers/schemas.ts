import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^\+?91?[6-9]\d{9}$/),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  birthday: z.coerce.date().optional().nullable()
});

export const customerQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  filter: z.enum(["ACTIVE", "DORMANT", "CREDIT", "active", "dormant", "creditPending"]).optional(),
  search: z.string().optional()
});

export const ledgerSchema = z.object({
  type: z.enum(["DEBIT", "CREDIT"]),
  amount: z.number().int().positive(),
  description: z.string().min(2)
});
