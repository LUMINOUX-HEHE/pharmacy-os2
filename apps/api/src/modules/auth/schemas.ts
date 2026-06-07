import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/)
});

export const verifyPhoneSchema = z.object({
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  otp: z.string().length(6).optional()
});

export const completeProfileSchema = z.object({
  email: z.string().email(),
  pharmacyName: z.string().min(2),
  licenseNo: z.string().min(4),
  gstin: z.string().min(15).max(15).optional().or(z.literal("")),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  address: z.object({
    street: z.string().min(3),
    city: z.string().min(2),
    state: z.string().min(2),
    pinCode: z.string().regex(/^\d{6}$/)
  }),
  pharmacyType: z.enum(["Independent", "Chain Branch"]),
  plan: z.enum(["STARTER", "GROWTH", "ENTERPRISE"]).default("STARTER")
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/)
});
