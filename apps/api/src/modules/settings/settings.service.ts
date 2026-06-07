import crypto from "node:crypto";

import { ErrorCode } from "@pharmacy-os/types";
import { slugify } from "@pharmacy-os/utils";
import type { StaffRole } from "@prisma/client";
import bcrypt from "bcrypt";
import type { z } from "zod";

import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { cacheKeys, redis } from "../../config/redis.js";
import { AppError } from "../../utils/app-error.js";
import { uploadMulterFileToCloudinary } from "../../utils/cloudinary-upload.js";
import { sendEmail } from "../../utils/mailer.js";

import type { acceptInviteSchema, inviteSchema, notificationSettingsSchema, pharmacySettingsSchema } from "./schemas.js";

type PharmacySettingsInput = z.infer<typeof pharmacySettingsSchema>;
type InviteInput = z.infer<typeof inviteSchema>;
type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

interface InvitePayload {
  email: string;
  role: StaffRole;
  pharmacyId: string;
  invitedBy?: string;
}

const inviteTtlSeconds = 48 * 60 * 60;
const localInvites = new Map<string, { payload: InvitePayload; expiresAt: number }>();
const localNotificationSettings = new Map<string, NotificationSettings>();

const defaultNotificationSettings: NotificationSettings = {
  emailAlerts: true,
  whatsappAlerts: true,
  inAppAlerts: true,
  lowStockThreshold: 10,
  expiryWarningDays: [7, 14, 30]
};

const canUseRedis = async (): Promise<boolean> => {
  if (redis.status === "ready") return true;
  if (redis.status !== "wait" && redis.status !== "end") return false;
  try {
    await redis.connect();
    return String(redis.status) === "ready";
  } catch {
    return false;
  }
};

const uniqueSlugFor = async (name: string, currentPharmacyId: string): Promise<string> => {
  const base = slugify(name);
  let slug = base;
  let suffix = 1;
  while (await prisma.pharmacy.findFirst({ where: { slug, id: { not: currentPharmacyId } }, select: { id: true } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
};

const userRoleForStaffRole = (role: StaffRole) => (role === "BILLING" ? "BILLING_STAFF" : role);

const storeInvite = async (token: string, payload: InvitePayload): Promise<void> => {
  const key = cacheKeys.teamInvite(token);
  localInvites.set(key, { payload, expiresAt: Date.now() + inviteTtlSeconds * 1000 });
  if (await canUseRedis()) {
    await redis.set(key, JSON.stringify(payload), "EX", inviteTtlSeconds);
  }
};

const readInvite = async (token: string): Promise<InvitePayload | null> => {
  const key = cacheKeys.teamInvite(token);
  if (await canUseRedis()) {
    const stored = await redis.get(key);
    return stored ? (JSON.parse(stored) as InvitePayload) : null;
  }

  const local = localInvites.get(key);
  if (!local) return null;
  if (local.expiresAt <= Date.now()) {
    localInvites.delete(key);
    return null;
  }
  return local.payload;
};

const deleteInvite = async (token: string): Promise<void> => {
  const key = cacheKeys.teamInvite(token);
  localInvites.delete(key);
  if (await canUseRedis()) {
    await redis.del(key);
  }
};

export const settingsService = {
  async updatePharmacy(pharmacyId: string, input: PharmacySettingsInput, logoFile?: Express.Multer.File) {
    const current = await prisma.pharmacy.findUnique({ where: { id: pharmacyId }, include: { storeSetting: true } });
    if (!current) throw new AppError("Pharmacy not found", 404, ErrorCode.SYSTEM_001);

    const logoUrl = logoFile
      ? await uploadMulterFileToCloudinary(logoFile, `pharmacy-os/pharmacies/${pharmacyId}/logo`)
      : input.logoUrl;

    const {
      isOnlineEnabled,
      bannerUrl,
      description,
      tagline,
      deliveryRadiusKm,
      minimumOrderValue,
      deliveryFee,
      acceptedPayments,
      operatingHours,
      ...pharmacyFields
    } = input;
    const storeUpdate = {
      ...(isOnlineEnabled !== undefined ? { enabled: isOnlineEnabled } : {}),
      ...(bannerUrl !== undefined ? { bannerUrl } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(tagline !== undefined ? { tagline } : {}),
      ...(deliveryRadiusKm !== undefined ? { deliveryRadiusKm } : {}),
      ...(minimumOrderValue !== undefined ? { minimumOrderValue } : {}),
      ...(deliveryFee !== undefined ? { deliveryFee } : {}),
      ...(acceptedPayments !== undefined ? { acceptedPayments } : {}),
      ...(operatingHours !== undefined ? { operatingHours } : {})
    };
    const updated = await prisma.$transaction(async (tx) => {
      const pharmacy = await tx.pharmacy.update({
        where: { id: pharmacyId },
        data: {
          ...pharmacyFields,
          ...(logoUrl !== undefined ? { logoUrl } : {}),
          ...(input.name && input.name !== current.name ? { slug: await uniqueSlugFor(input.name, pharmacyId) } : {})
        }
      });

      if (Object.keys(storeUpdate).length > 0) {
        await tx.storeSetting.upsert({
          where: { pharmacyId },
          create: {
            pharmacyId,
            enabled: isOnlineEnabled ?? true,
            bannerUrl,
            description: description ?? `${pharmacy.name} online medicine ordering and refill support.`,
            tagline: tagline ?? "Trusted medicines delivered from your neighborhood pharmacy.",
            deliveryRadiusKm: deliveryRadiusKm ?? 5,
            minimumOrderValue: minimumOrderValue ?? 20000,
            deliveryFee: deliveryFee ?? 3000,
            acceptedPayments,
            operatingHours: {
              monday: ["09:00", "22:00"],
              tuesday: ["09:00", "22:00"],
              wednesday: ["09:00", "22:00"],
              thursday: ["09:00", "22:00"],
              friday: ["09:00", "22:00"],
              saturday: ["09:00", "22:00"],
              sunday: ["10:00", "20:00"],
              ...(operatingHours ?? {})
            }
          },
          update: storeUpdate
        });
      }

      return pharmacy;
    });

    return updated;
  },

  async inviteTeamMember(pharmacyId: string, invitedBy: string | undefined, input: InviteInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, select: { id: true } });
    if (existing) throw new AppError("A user with this email already exists", 409, ErrorCode.AUTH_003);

    const token = crypto.randomBytes(32).toString("hex");
    await storeInvite(token, { email: input.email.toLowerCase(), role: input.role, pharmacyId, invitedBy });
    const acceptUrl = `${env.FRONTEND_URL}/auth/accept-invite?token=${token}`;
    await sendEmail({
      to: input.email,
      subject: "You are invited to Pharmacy OS",
      html: `<p>You have been invited to join Pharmacy OS.</p><p><a href="${acceptUrl}">Accept invitation</a></p><p>This invite expires in 48 hours.</p>`,
      text: `Accept your Pharmacy OS invitation: ${acceptUrl}. This invite expires in 48 hours.`
    });

    return {
      email: input.email.toLowerCase(),
      role: input.role,
      expiresAt: new Date(Date.now() + inviteTtlSeconds * 1000)
    };
  },

  async acceptInvite(input: AcceptInviteInput) {
    const invite = await readInvite(input.token);
    if (!invite) throw new AppError("Invite token is invalid or expired", 400, ErrorCode.AUTH_002);

    const user = await prisma.user.create({
      data: {
        email: invite.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: userRoleForStaffRole(invite.role),
        pharmacyId: invite.pharmacyId,
        isVerified: true,
        staff: {
          create: {
            pharmacyId: invite.pharmacyId,
            role: invite.role
          }
        }
      },
      include: { staff: true, pharmacy: true }
    });
    await deleteInvite(input.token);
    return user;
  },

  async getNotificationSettings(pharmacyId: string): Promise<NotificationSettings> {
    const key = cacheKeys.notificationSettings(pharmacyId);
    if (await canUseRedis()) {
      const stored = await redis.get(key);
      return stored ? (JSON.parse(stored) as NotificationSettings) : defaultNotificationSettings;
    }
    return localNotificationSettings.get(key) ?? defaultNotificationSettings;
  },

  async updateNotificationSettings(pharmacyId: string, input: NotificationSettings): Promise<NotificationSettings> {
    const key = cacheKeys.notificationSettings(pharmacyId);
    localNotificationSettings.set(key, input);
    if (await canUseRedis()) {
      await redis.set(key, JSON.stringify(input));
    }
    return input;
  },

  async subscription(pharmacyId: string) {
    const [pharmacy, subscription] = await Promise.all([
      prisma.pharmacy.findUnique({ where: { id: pharmacyId } }),
      prisma.subscription.findFirst({ where: { pharmacyId }, orderBy: { createdAt: "desc" } })
    ]);
    if (!pharmacy) throw new AppError("Pharmacy not found", 404, ErrorCode.SYSTEM_001);
    const planExpiresAt = pharmacy.planExpiresAt ?? subscription?.currentPeriodEnd ?? null;
    const daysRemaining = planExpiresAt ? Math.max(0, Math.ceil((planExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null;

    return {
      plan: pharmacy.plan,
      planExpiresAt,
      daysRemaining,
      subscription
    };
  }
};
