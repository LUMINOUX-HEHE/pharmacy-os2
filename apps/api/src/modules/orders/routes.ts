import { ErrorCode } from "@pharmacy-os/types";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Orders
 *     description: E-commerce order kanban, status transitions, driver assignment, and customer notifications.
 */


import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validation.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { routeParam } from "../../utils/request.js";

import { ordersService } from "./orders.service.js";
import { assignDriverSchema, orderQuerySchema, statusUpdateSchema } from "./schemas.js";

export const ordersRouter = Router();

ordersRouter.use(authenticate);

ordersRouter.get("/", requirePermission("orders:read"), validate(orderQuerySchema, "query"), async (req, res, next) => {
  try {
    const query = orderQuerySchema.parse(req.query);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const orders = await prisma.order.findMany({
      where: {
        pharmacyId: req.user?.pharmacyId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.date === "today" ? { createdAt: { gte: startOfToday } } : {})
      },
      include: { customer: true, items: { include: { medicine: true } }, deliveryDriver: true, timeline: true },
      orderBy: { createdAt: "desc" }
    });
    sendSuccess(res, orders, "Orders loaded");
  } catch (error) {
    next(error);
  }
});

ordersRouter.get("/:id", requirePermission("orders:read"), async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: routeParam(req, "id"), pharmacyId: req.user?.pharmacyId },
      include: {
        customer: true,
        items: { include: { medicine: true } },
        deliveryDriver: true,
        delivery: true,
        timeline: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!order) throw new AppError("Order not found", 404, ErrorCode.ORDER_001);
    sendSuccess(res, order, "Order loaded");
  } catch (error) {
    next(error);
  }
});

ordersRouter.put("/:id/status", requirePermission("orders:write"), validate(statusUpdateSchema), async (req, res, next) => {
  try {
    const input = statusUpdateSchema.parse(req.body);
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const order = await ordersService.updateStatus({
      pharmacyId,
      orderId: routeParam(req, "id"),
      status: input.status,
      note: input.note
    });
    sendSuccess(res, order, "Order status updated");
  } catch (error) {
    next(error);
  }
});

ordersRouter.post("/:id/assign-driver", requirePermission("orders:write"), validate(assignDriverSchema), async (req, res, next) => {
  try {
    const input = assignDriverSchema.parse(req.body);
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const order = await ordersService.assignDriver({
      pharmacyId,
      orderId: routeParam(req, "id"),
      driverId: input.driverId
    });
    sendSuccess(res, order, "Driver assigned");
  } catch (error) {
    next(error);
  }
});

ordersRouter.post("/:id/notify", requirePermission("orders:write"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const result = await ordersService.notifyCustomer({
      pharmacyId,
      orderId: routeParam(req, "id"),
      userId: req.user?.id,
      ip: req.ip
    });
    sendSuccess(res, result, "Customer notified");
  } catch (error) {
    next(error);
  }
});
