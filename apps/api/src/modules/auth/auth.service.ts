import crypto from "node:crypto";

import { ErrorCode } from "@pharmacy-os/types";
import { slugify } from "@pharmacy-os/utils";
import type { Pharmacy, Staff, User } from "@prisma/client";
import bcrypt from "bcrypt";
import type { z } from "zod";

import { env, isProduction, isTest } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { cacheKeys, redis } from "../../config/redis.js";
import { permissionsForRole } from "../../middleware/auth.js";
import { AppError } from "../../utils/app-error.js";
import {
  hashOpaqueToken,
  revokeRefreshTokenFromToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../../utils/auth-tokens.js";
import { sendEmail } from "../../utils/mailer.js";
import { sendWhatsApp } from "../../utils/whatsapp.js";

import type {
  completeProfileSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyPhoneSchema
} from "./schemas.js";

const otpTtlSeconds = 10 * 60;
const otpTtlMs = otpTtlSeconds * 1000;
const localOtps = new Map<string, { hash: string; expiresAt: number }>();

type RegisterInput = z.infer<typeof registerSchema>;
type VerifyPhoneInput = z.infer<typeof verifyPhoneSchema>;
type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

type SafeUser = Pick<User, "id" | "email" | "role" | "pharmacyId" | "isVerified" | "createdAt">;
type SafeStaff = Pick<Staff, "id" | "userId" | "pharmacyId" | "role" | "createdAt" | "updatedAt">;
type PermissionObject = Record<string, Record<string, boolean>>;

const canUseRedis = async (): Promise<boolean> => {
  if (isTest) return false;
  if (redis.status === "ready") return true;
  if (redis.status !== "wait" && redis.status !== "end") return false;

  try {
    await redis.connect();
    return String(redis.status) === "ready";
  } catch {
    return false;
  }
};

const safeUser = (user: User): SafeUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  pharmacyId: user.pharmacyId,
  isVerified: user.isVerified,
  createdAt: user.createdAt
});

const permissionsObject = (permissions: string[]): PermissionObject =>
  permissions.reduce<PermissionObject>((acc, permission) => {
    const [module, action] = permission.split(":");
    if (!module || !action) return acc;
    acc[module] = { ...(acc[module] ?? {}), [action]: true };
    return acc;
  }, {});

const generateOtp = (): string => crypto.randomInt(100000, 1000000).toString();

const storeOtpHash = async (phone: string, hash: string): Promise<void> => {
  const key = cacheKeys.otp(phone);
  if (await canUseRedis()) {
    await redis.set(key, hash, "EX", otpTtlSeconds);
    return;
  }
  localOtps.set(key, { hash, expiresAt: Date.now() + otpTtlMs });
};

const getOtpHash = async (phone: string): Promise<string | null> => {
  const key = cacheKeys.otp(phone);
  if (await canUseRedis()) {
    return redis.get(key);
  }

  const local = localOtps.get(key);
  if (!local) return null;
  if (local.expiresAt <= Date.now()) {
    localOtps.delete(key);
    return null;
  }
  return local.hash;
};

const deleteOtp = async (phone: string): Promise<void> => {
  const key = cacheKeys.otp(phone);
  localOtps.delete(key);
  if (await canUseRedis()) {
    await redis.del(key);
  }
};

const ensureUniqueSlug = async (name: string): Promise<string> => {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.pharmacy.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
};

export const authService = {
  async register(input: RegisterInput): Promise<SafeUser> {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const verificationToken = crypto.randomUUID();
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role: "OWNER",
        verificationToken
      }
    });

    const verifyUrl = `${env.FRONTEND_URL}/auth/verify-email/${verificationToken}`;
    await sendEmail({
      to: user.email,
      subject: "Verify your Pharmacy OS account",
      html: `<p>Hello ${input.fullName}, verify your account by opening <a href="${verifyUrl}">${verifyUrl}</a>.</p>`,
      text: `Verify your Pharmacy OS account: ${verifyUrl}`
    });

    return safeUser(user);
  },

  async verifyPhone(input: VerifyPhoneInput): Promise<{ phone: string; verified: boolean; expiresInSeconds?: number; otp?: string }> {
    if (!input.otp) {
      const otp = generateOtp();
      await storeOtpHash(input.phone, await bcrypt.hash(otp, 12));
      await sendWhatsApp({
        to: input.phone,
        body: `Your Pharmacy OS verification code is ${otp}. It expires in 10 minutes.`
      });

      return {
        phone: input.phone,
        verified: false,
        expiresInSeconds: otpTtlSeconds,
        ...(isProduction ? {} : { otp })
      };
    }

    const storedHash = await getOtpHash(input.phone);
    const valid = storedHash ? await bcrypt.compare(input.otp, storedHash) : false;
    if (!valid) {
      throw new AppError("OTP is invalid or expired", 400, ErrorCode.AUTH_002);
    }

    await deleteOtp(input.phone);
    return { phone: input.phone, verified: true };
  },

  async completeProfile(input: CompleteProfileInput): Promise<Pharmacy> {
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user) {
      throw new AppError("Create the account before completing pharmacy profile", 404, ErrorCode.AUTH_001);
    }
    if (user.pharmacyId) {
      throw new AppError("Pharmacy profile is already complete", 409, ErrorCode.AUTH_003);
    }

    const slug = await ensureUniqueSlug(input.pharmacyName);

    return prisma.$transaction(async (tx) => {
      const pharmacy = await tx.pharmacy.create({
        data: {
          name: input.pharmacyName,
          slug,
          licenseNo: input.licenseNo,
          gstin: input.gstin || null,
          address: input.address.street,
          city: input.address.city,
          state: input.address.state,
          pinCode: input.address.pinCode,
          phone: input.phone,
          plan: input.plan,
          planExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          storeSetting: {
            create: {
              description: `${input.pharmacyName} online medicine ordering and refill support.`,
              tagline: "Trusted medicines delivered from your neighborhood pharmacy.",
              deliveryRadiusKm: 5,
              minimumOrderValue: 20000,
              deliveryFee: 3000,
              operatingHours: {
                monday: ["09:00", "22:00"],
                tuesday: ["09:00", "22:00"],
                wednesday: ["09:00", "22:00"],
                thursday: ["09:00", "22:00"],
                friday: ["09:00", "22:00"],
                saturday: ["09:00", "22:00"],
                sunday: ["10:00", "20:00"]
              }
            }
          }
        }
      });

      await tx.user.update({
        where: { id: user.id },
        data: { pharmacyId: pharmacy.id, isVerified: true, verificationToken: null }
      });

      await tx.staff.create({
        data: {
          userId: user.id,
          pharmacyId: pharmacy.id,
          role: "OWNER"
        }
      });

      return pharmacy;
    });
  },

  async login(input: LoginInput): Promise<{
    accessToken: string;
    refreshToken: string;
    user: SafeUser;
    pharmacy: Pharmacy;
    staffRole: Staff["role"];
    permissions: string[];
  }> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { pharmacy: true, staff: true }
    });
    const validPassword = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !validPassword || !user.pharmacy || !user.staff) {
      throw new AppError("Invalid email or password", 401, ErrorCode.AUTH_001);
    }

    const accessToken = signAccessToken({ sub: user.id, pharmacyId: user.pharmacy.id, role: user.role });
    const { refreshToken } = await signRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: safeUser(user),
      pharmacy: user.pharmacy,
      staffRole: user.staff.role,
      permissions: permissionsForRole(user.staff.role)
    };
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = await verifyRefreshToken(refreshToken);
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { pharmacy: true } });
      if (!user?.pharmacyId || !user.pharmacy) {
        throw new AppError("Refresh token user no longer exists", 401, ErrorCode.AUTH_002);
      }

      const accessToken = signAccessToken({ sub: user.id, pharmacyId: user.pharmacyId, role: user.role });
      const nextRefreshToken = await signRefreshToken(user.id);
      return { accessToken, refreshToken: nextRefreshToken.refreshToken };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Refresh token is invalid or expired", 401, ErrorCode.AUTH_002);
    }
  },

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await revokeRefreshTokenFromToken(refreshToken);
    }
  },

  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user) return;

    const token = crypto.randomUUID();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashOpaqueToken(token),
        resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    });
    await sendEmail({
      to: user.email,
      subject: "Reset your Pharmacy OS password",
      html: `<p>Reset your password: <a href="${env.FRONTEND_URL}/auth/reset-password/${token}">Reset password</a></p>`,
      text: `Reset your password: ${env.FRONTEND_URL}/auth/reset-password/${token}`
    });
  },

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = hashOpaqueToken(input.token);
    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: { gt: new Date() }
      }
    });
    if (!user) {
      throw new AppError("Reset token is invalid or expired", 400, ErrorCode.AUTH_002);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(input.password, 12),
        resetTokenHash: null,
        resetTokenExpiresAt: null
      }
    });
  },

  async validateResetToken(token: string): Promise<void> {
    if (!token || token.length < 16) {
      throw new AppError("Reset token is invalid or expired", 400, ErrorCode.AUTH_002);
    }

    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash: hashOpaqueToken(token),
        resetTokenExpiresAt: { gt: new Date() }
      },
      select: { id: true }
    });
    if (!user) {
      throw new AppError("Reset token is invalid or expired", 400, ErrorCode.AUTH_002);
    }
  },

  async verifyEmail(token: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { verificationToken: token } });
    if (!user) {
      throw new AppError("Verification link is invalid or expired", 400, ErrorCode.AUTH_002);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationToken: null }
    });
  },

  async me(userId: string): Promise<{
    user: SafeUser;
    pharmacy: Pharmacy;
    staff: SafeStaff;
    staffRole: Staff["role"];
    permissions: PermissionObject;
    permissionKeys: string[];
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { pharmacy: true, staff: true }
    });

    if (!user?.pharmacy || !user.staff) {
      throw new AppError("User session is no longer valid", 401, ErrorCode.AUTH_002);
    }

    const permissionKeys = permissionsForRole(user.staff.role);
    return {
      user: safeUser(user),
      pharmacy: user.pharmacy,
      staff: {
        id: user.staff.id,
        userId: user.staff.userId,
        pharmacyId: user.staff.pharmacyId,
        role: user.staff.role,
        createdAt: user.staff.createdAt,
        updatedAt: user.staff.updatedAt
      },
      staffRole: user.staff.role,
      permissions: permissionsObject(permissionKeys),
      permissionKeys
    };
  }
};
