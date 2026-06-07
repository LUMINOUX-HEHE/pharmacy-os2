import { ErrorCode } from "@pharmacy-os/types";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Settings
 *     description: Pharmacy profile, notification preferences, team access, integrations, and subscriptions.
 */

import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validation.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { createPaymentOrder } from "../../utils/payments.js";
import { routeParam } from "../../utils/request.js";
import { upload } from "../../utils/upload.js";
import { sendWhatsApp } from "../../utils/whatsapp.js";

import { settingsService } from "./settings.service.js";
import {
  acceptInviteSchema,
  inviteSchema,
  notificationSettingsSchema,
  pharmacySettingsSchema,
  roleSchema,
  subscriptionSchema
} from "./schemas.js";

export const settingsRouter = Router();

settingsRouter.post("/team/invite/accept", validate(acceptInviteSchema), async (req, res, next) => {
  try {
    const user = await settingsService.acceptInvite(acceptInviteSchema.parse(req.body));
    sendSuccess(res, user, "Invitation accepted", 201);
  } catch (error) {
    next(error);
  }
});

settingsRouter.use(authenticate);

settingsRouter.get("/pharmacy", requirePermission("settings:read"), async (req, res, next) => {
  try {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: req.user?.pharmacyId },
      include: { storeSetting: true }
    });
    if (!pharmacy) throw new AppError("Pharmacy not found", 404, ErrorCode.SYSTEM_001);
    sendSuccess(res, { ...pharmacy, isOnlineEnabled: pharmacy.storeSetting?.enabled ?? false }, "Pharmacy settings loaded");
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/pharmacy", requirePermission("settings:write"), upload.single("logo"), validate(pharmacySettingsSchema), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const pharmacy = await settingsService.updatePharmacy(pharmacyId, pharmacySettingsSchema.parse(req.body), req.file);
    sendSuccess(res, pharmacy, "Pharmacy profile updated");
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/notifications", requirePermission("settings:read"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const settings = await settingsService.getNotificationSettings(pharmacyId);
    sendSuccess(res, settings, "Notification preferences loaded");
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/notifications", requirePermission("settings:write"), validate(notificationSettingsSchema), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const settings = await settingsService.updateNotificationSettings(pharmacyId, notificationSettingsSchema.parse(req.body));
    sendSuccess(res, settings, "Notification preferences updated");
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/integrations/whatsapp/test", requirePermission("settings:write"), async (req, res, next) => {
  try {
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: req.user?.pharmacyId } });
    const result = await sendWhatsApp({
      to: pharmacy?.phone ?? "+919800000000",
      body: "Pharmacy OS WhatsApp integration test message."
    });
    sendSuccess(res, result, "WhatsApp integration tested");
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/integrations/razorpay/test", requirePermission("settings:write"), async (req, res, next) => {
  try {
    const order = await createPaymentOrder({
      amount: 100,
      receipt: `settings-test-${req.user?.pharmacyId ?? "demo"}-${Date.now()}`,
      notes: { type: "settings-test", pharmacyId: req.user?.pharmacyId ?? "" }
    });
    sendSuccess(res, order, "Razorpay integration tested");
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/team", requirePermission("settings:read"), async (req, res, next) => {
  try {
    const staff = await prisma.staff.findMany({
      where: { pharmacyId: req.user?.pharmacyId },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    });
    sendSuccess(res, staff, "Team loaded");
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/team/invite", requirePermission("team:manage"), validate(inviteSchema), async (req, res, next) => {
  try {
    const input = inviteSchema.parse(req.body);
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const invite = await settingsService.inviteTeamMember(pharmacyId, req.user?.id, input);
    sendSuccess(res, invite, "Invitation sent", 201);
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/subscription", requirePermission("settings:read"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const subscription = await settingsService.subscription(pharmacyId);
    sendSuccess(res, subscription, "Subscription loaded");
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/subscription/upgrade", requirePermission("subscription:manage"), validate(subscriptionSchema), async (req, res, next) => {
  try {
    const input = subscriptionSchema.parse(req.body);
    const paymentOrder = await createPaymentOrder({
      amount: input.plan === "ENTERPRISE" ? 799900 : input.plan === "GROWTH" ? 299900 : 149900,
      receipt: `sub-${req.user?.pharmacyId ?? "demo"}-${Date.now()}`,
      notes: { type: "subscription-upgrade", plan: input.plan }
    });
    const pharmacy = await prisma.pharmacy.update({ where: { id: req.user?.pharmacyId }, data: { plan: input.plan } });
    const subscription = await prisma.subscription.create({
      data: {
        pharmacyId: pharmacy.id,
        plan: input.plan,
        status: "ACTIVE",
        razorpaySubId: paymentOrder.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    sendSuccess(res, { pharmacy, subscription, razorpay: paymentOrder }, "Subscription updated");
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/subscription/cancel", requirePermission("subscription:manage"), async (req, res, next) => {
  try {
    const pharmacy = await prisma.pharmacy.update({ where: { id: req.user?.pharmacyId }, data: { planExpiresAt: new Date() } });
    const latest = await prisma.subscription.findFirst({ where: { pharmacyId: pharmacy.id }, orderBy: { createdAt: "desc" } });
    const subscription = latest
      ? await prisma.subscription.update({ where: { id: latest.id }, data: { status: "CANCELLED", currentPeriodEnd: new Date() } })
      : null;
    sendSuccess(res, { pharmacy, subscription }, "Subscription cancelled");
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/team/:id/role", requirePermission("team:manage"), validate(roleSchema), async (req, res, next) => {
  try {
    const input = roleSchema.parse(req.body);
    const staff = await prisma.staff.update({ where: { id: routeParam(req, "id") }, data: { role: input.role } });
    await prisma.user.update({
      where: { id: staff.userId },
      data: { role: input.role === "BILLING" ? "BILLING_STAFF" : input.role }
    });
    sendSuccess(res, staff, "Role updated");
  } catch (error) {
    next(error);
  }
});

settingsRouter.delete("/team/:id", requirePermission("team:manage"), async (req, res, next) => {
  try {
    const staff = await prisma.staff.delete({ where: { id: routeParam(req, "id") } });
    await prisma.user.update({ where: { id: staff.userId }, data: { pharmacyId: null } });
    sendSuccess(res, staff, "Access revoked");
  } catch (error) {
    next(error);
  }
});
