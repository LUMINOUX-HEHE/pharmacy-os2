import { ErrorCode } from "@pharmacy-os/types";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Delivery
 *     description: Delivery driver CRUD, live delivery tracking, and delivery history.
 */

import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validation.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { routeParam } from "../../utils/request.js";

import { deliveryService } from "./delivery.service.js";
import { driverSchema } from "./schemas.js";

export const deliveryRouter = Router();

deliveryRouter.use(authenticate);

deliveryRouter.get("/drivers", requirePermission("delivery:read"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const drivers = await deliveryService.listDrivers(pharmacyId);
    sendSuccess(res, drivers, "Drivers loaded");
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/drivers", requirePermission("delivery:write"), validate(driverSchema), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const driver = await deliveryService.createDriver(pharmacyId, driverSchema.parse(req.body));
    sendSuccess(res, driver, "Driver created", 201);
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/drivers/:id", requirePermission("delivery:read"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const driver = await deliveryService.getDriver(pharmacyId, routeParam(req, "id"));
    sendSuccess(res, driver, "Driver loaded");
  } catch (error) {
    next(error);
  }
});

deliveryRouter.put("/drivers/:id", requirePermission("delivery:write"), validate(driverSchema.partial()), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const driver = await deliveryService.updateDriver(pharmacyId, routeParam(req, "id"), driverSchema.partial().parse(req.body));
    sendSuccess(res, driver, "Driver updated");
  } catch (error) {
    next(error);
  }
});

deliveryRouter.delete("/drivers/:id", requirePermission("delivery:write"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const driver = await deliveryService.deleteDriver(pharmacyId, routeParam(req, "id"));
    sendSuccess(res, driver, "Driver deleted");
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/live", requirePermission("delivery:read"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const live = await deliveryService.liveDeliveries(pharmacyId);
    sendSuccess(res, live, "Live deliveries loaded");
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/history", requirePermission("delivery:read"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const history = await deliveryService.history(pharmacyId);
    sendSuccess(res, history, "Delivery history loaded");
  } catch (error) {
    next(error);
  }
});
