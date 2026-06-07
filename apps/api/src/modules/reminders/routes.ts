import { ErrorCode } from "@pharmacy-os/types";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Reminders
 *     description: Refill reminder schedules and manual WhatsApp sends.
 */


import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validation.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { routeParam } from "../../utils/request.js";

import { remindersService } from "./reminders.service.js";
import { reminderSchema } from "./schemas.js";

export const remindersRouter = Router();

remindersRouter.use(authenticate);

remindersRouter.get("/", requirePermission("customers:read"), async (req, res, next) => {
  try {
    const reminders = await prisma.reminder.findMany({
      where: { pharmacyId: req.user?.pharmacyId, isActive: true },
      include: { customer: true, medicine: true, logs: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: { nextSendAt: "asc" }
    });
    sendSuccess(res, reminders, "Reminders loaded");
  } catch (error) {
    next(error);
  }
});

remindersRouter.post("/", requirePermission("customers:write"), validate(reminderSchema), async (req, res, next) => {
  try {
    const input = reminderSchema.parse(req.body);
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const reminder = await remindersService.createReminder(pharmacyId, input);
    sendSuccess(res, reminder, "Reminder created", 201);
  } catch (error) {
    next(error);
  }
});

remindersRouter.put("/:id", requirePermission("customers:write"), validate(reminderSchema.partial()), async (req, res, next) => {
  try {
    const input = reminderSchema.partial().parse(req.body);
    const reminder = await prisma.reminder.update({ where: { id: routeParam(req, "id") }, data: input });
    sendSuccess(res, reminder, "Reminder updated");
  } catch (error) {
    next(error);
  }
});

remindersRouter.delete("/:id", requirePermission("customers:write"), async (req, res, next) => {
  try {
    const reminder = await prisma.reminder.update({ where: { id: routeParam(req, "id") }, data: { isActive: false } });
    sendSuccess(res, reminder, "Reminder deleted");
  } catch (error) {
    next(error);
  }
});

remindersRouter.post("/:id/send-now", requirePermission("customers:write"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const updated = await remindersService.sendNow(pharmacyId, routeParam(req, "id"));
    sendSuccess(res, updated, "Reminder sent");
  } catch (error) {
    next(error);
  }
});
