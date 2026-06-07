import { ErrorCode } from "@pharmacy-os/types";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Distributors
 *     description: Distributor directory and purchase-order procurement workflows.
 */

import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validation.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { routeParam } from "../../utils/request.js";

import { distributorsService } from "./distributors.service.js";
import { distributorSchema, poSchema } from "./schemas.js";

export const distributorsRouter = Router();

distributorsRouter.use(authenticate);

distributorsRouter.get("/distributors", requirePermission("inventory:read"), async (req, res, next) => {
  try {
    const distributors = await prisma.distributor.findMany({
      where: { pharmacyId: req.user?.pharmacyId, isActive: true },
      orderBy: { name: "asc" }
    });
    sendSuccess(res, distributors, "Distributors loaded");
  } catch (error) {
    next(error);
  }
});

distributorsRouter.post("/distributors", requirePermission("inventory:write"), validate(distributorSchema), async (req, res, next) => {
  try {
    const input = distributorSchema.parse(req.body);
    const distributor = await prisma.distributor.create({
      data: { ...input, pharmacyId: req.user?.pharmacyId ?? "" }
    });
    sendSuccess(res, distributor, "Distributor created", 201);
  } catch (error) {
    next(error);
  }
});

distributorsRouter.put("/distributors/:id", requirePermission("inventory:write"), validate(distributorSchema.partial()), async (req, res, next) => {
  try {
    const distributor = await prisma.distributor.update({ where: { id: routeParam(req, "id") }, data: distributorSchema.partial().parse(req.body) });
    sendSuccess(res, distributor, "Distributor updated");
  } catch (error) {
    next(error);
  }
});

distributorsRouter.delete("/distributors/:id", requirePermission("inventory:write"), async (req, res, next) => {
  try {
    const distributor = await prisma.distributor.update({ where: { id: routeParam(req, "id") }, data: { isActive: false } });
    sendSuccess(res, distributor, "Distributor deleted");
  } catch (error) {
    next(error);
  }
});

distributorsRouter.get("/purchase-orders", requirePermission("inventory:read"), async (req, res, next) => {
  try {
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { pharmacyId: req.user?.pharmacyId },
      include: { distributor: true, items: { include: { medicine: true } } },
      orderBy: { createdAt: "desc" }
    });
    sendSuccess(res, purchaseOrders, "Purchase orders loaded");
  } catch (error) {
    next(error);
  }
});

distributorsRouter.post("/purchase-orders", requirePermission("inventory:write"), validate(poSchema), async (req, res, next) => {
  try {
    const input = poSchema.parse(req.body);
    const totalAmount = input.items.reduce((sum, item) => sum + item.purchasePrice * item.quantity, 0);
    const po = await prisma.purchaseOrder.create({
      data: {
        pharmacyId: req.user?.pharmacyId ?? "",
        distributorId: input.distributorId,
        totalAmount,
        notes: input.notes,
        items: { create: input.items }
      },
      include: { distributor: true, items: { include: { medicine: true } } }
    });
    sendSuccess(res, po, "Purchase order created", 201);
  } catch (error) {
    next(error);
  }
});

distributorsRouter.put("/purchase-orders/:id/send", requirePermission("inventory:write"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const po = await distributorsService.sendPurchaseOrder({
      pharmacyId,
      poId: routeParam(req, "id"),
      userId: req.user?.id,
      ip: req.ip
    });
    sendSuccess(res, po, "Purchase order sent");
  } catch (error) {
    next(error);
  }
});

distributorsRouter.post("/purchase-orders/:id/receive", requirePermission("inventory:write"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const received = await distributorsService.receivePurchaseOrder({
      pharmacyId,
      poId: routeParam(req, "id"),
      userId: req.user?.id,
      ip: req.ip
    });
    sendSuccess(res, received, "Purchase order received and stock updated");
  } catch (error) {
    next(error);
  }
});
