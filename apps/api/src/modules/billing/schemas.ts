import { z } from "zod";

export const billItemSchema = z.object({
  medicineId: z.string().min(1),
  quantity: z.number().int().positive(),
  discount: z.number().min(0).max(100).optional()
});

export const createBillSchema = z.object({
  patientName: z.string().min(2).optional().nullable(),
  patientPhone: z.string().optional().nullable(),
  doctorName: z.string().optional().nullable(),
  prescriptionUrl: z.string().url().optional().nullable(),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),
  discount: z.number().min(0).max(100).default(0),
  idempotencyKey: z.string().uuid().optional(),
  items: z.array(billItemSchema).min(1)
});

export const billQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  status: z.enum(["DRAFT", "PAID", "CREDIT", "VOID"]).optional(),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

export const paymentUpdateSchema = z.object({
  status: z.enum(["DRAFT", "PAID", "CREDIT", "VOID"]),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).optional()
});

export const razorpayOrderSchema = z.object({
  amount: z.number().int().positive(),
  receipt: z.string().min(1).optional()
});
