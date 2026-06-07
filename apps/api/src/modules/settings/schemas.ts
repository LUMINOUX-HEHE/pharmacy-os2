import { z } from "zod";

export const pharmacySettingsSchema = z.object({
  name: z.string().min(2).optional(),
  licenseNo: z.string().min(4).optional(),
  gstin: z.string().min(15).max(15).optional().nullable(),
  address: z.string().min(3).optional(),
  city: z.string().min(2).optional(),
  state: z.string().min(2).optional(),
  pinCode: z.string().regex(/^\d{6}$/).optional(),
  phone: z.string().min(10).optional(),
  logoUrl: z.string().url().optional().nullable(),
  isOnlineEnabled: z.coerce.boolean().optional(),
  bannerUrl: z.string().url().optional().nullable(),
  description: z.string().min(2).optional(),
  tagline: z.string().min(2).optional(),
  deliveryRadiusKm: z.coerce.number().int().positive().optional(),
  minimumOrderValue: z.coerce.number().int().nonnegative().optional(),
  deliveryFee: z.coerce.number().int().nonnegative().optional(),
  acceptedPayments: z.array(z.enum(["CASH", "UPI", "CARD", "CREDIT"])).optional(),
  operatingHours: z.record(z.string(), z.tuple([z.string(), z.string()])).optional()
});

export const notificationSettingsSchema = z.object({
  emailAlerts: z.boolean(),
  whatsappAlerts: z.boolean(),
  inAppAlerts: z.boolean(),
  lowStockThreshold: z.number().int().positive(),
  expiryWarningDays: z.array(z.number().int().positive())
});

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["MANAGER", "BILLING", "DELIVERY"])
});

export const acceptInviteSchema = z.object({
  token: z.string().min(24),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/)
});

export const roleSchema = z.object({
  role: z.enum(["OWNER", "MANAGER", "BILLING", "DELIVERY"])
});

export const subscriptionSchema = z.object({
  plan: z.enum(["STARTER", "GROWTH", "ENTERPRISE"])
});
