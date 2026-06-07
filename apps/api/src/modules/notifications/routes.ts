import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: In-app notification list and read-state updates.
 */

import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";
import { routeParam } from "../../utils/request.js";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { pharmacyId: req.user?.pharmacyId },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    sendSuccess(res, notifications, "Notifications loaded");
  } catch (error) {
    next(error);
  }
});

notificationsRouter.put("/:id/read", async (req, res, next) => {
  try {
    const notification = await prisma.notification.update({ where: { id: routeParam(req, "id") }, data: { isRead: true } });
    sendSuccess(res, notification, "Notification marked read");
  } catch (error) {
    next(error);
  }
});
