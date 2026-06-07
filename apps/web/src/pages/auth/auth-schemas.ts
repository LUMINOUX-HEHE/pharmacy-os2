import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().default(true)
});

export const signupSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Use at least 8 characters").regex(/[A-Z]/, "Add one uppercase letter").regex(/[0-9]/, "Add one number"),
    confirmPassword: z.string().min(8),
    termsAccepted: z.boolean().refine(Boolean, "Accept the terms"),
    pharmacyName: z.string().min(2, "Enter pharmacy name"),
    licenseNo: z.string().min(4, "Enter drug license number"),
    gstin: z.string().min(15, "GSTIN must be 15 characters").max(15).optional().or(z.literal("")),
    phone: z.string().regex(/^\+91[6-9]\d{9}$/, "Use +91 mobile format"),
    street: z.string().min(3, "Enter street address"),
    city: z.string().min(2, "Enter city"),
    state: z.string().min(2, "Enter state"),
    pinCode: z.string().regex(/^\d{6}$/, "Enter 6 digit PIN"),
    pharmacyType: z.enum(["Independent", "Chain Branch"]),
    plan: z.enum(["STARTER", "GROWTH"])
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match"
  });
