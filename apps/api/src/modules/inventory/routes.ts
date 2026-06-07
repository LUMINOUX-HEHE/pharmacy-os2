import { ErrorCode } from "@pharmacy-os/types";
import { slugify } from "@pharmacy-os/utils";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Inventory
 *     description: Medicine catalogue, filtering, stock alerts, CSV import, and CSV export.
 */


import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validation.js";
import { sendPaginated, sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { audit } from "../../utils/audit.js";
import { routeParam } from "../../utils/request.js";
import { upload } from "../../utils/upload.js";

import { inventoryService } from "./inventory.service.js";
import { inventoryQuerySchema, medicineSchema, updateMedicineSchema } from "./schemas.js";

export const inventoryRouter = Router();

inventoryRouter.use(authenticate);

inventoryRouter.get("/", requirePermission("inventory:read"), validate(inventoryQuerySchema, "query"), async (req, res, next) => {
  try {
    const query = inventoryQuerySchema.parse(req.query);
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const result = await inventoryService.listMedicines(pharmacyId, query);
    sendPaginated(res, result, "Inventory loaded");
  } catch (error) {
    next(error);
  }
});

inventoryRouter.post("/", requirePermission("inventory:write"), validate(medicineSchema), async (req, res, next) => {
  try {
    const input = medicineSchema.parse(req.body);
    const pharmacyId = req.user?.pharmacyId;
    const userId = req.user?.id;
    if (!pharmacyId || !userId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);

    const medicine = await prisma.medicine.create({
      data: {
        ...input,
        sku: input.sku ?? `MED-${slugify(input.name).slice(0, 12).toUpperCase()}-${Date.now().toString().slice(-5)}`,
        pharmacyId
      }
    });
    await audit({ pharmacyId, userId, action: "inventory.create", entity: "Medicine", entityId: medicine.id, ip: req.ip });
    sendSuccess(res, medicine, "Medicine added", 201);
  } catch (error) {
    next(error);
  }
});

inventoryRouter.get("/alerts/low-stock", requirePermission("inventory:read"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const alerts = await inventoryService.lowStockAlerts(pharmacyId);
    sendSuccess(res, alerts, "Low stock alerts loaded");
  } catch (error) {
    next(error);
  }
});

inventoryRouter.get("/alerts/expiry", requirePermission("inventory:read"), async (req, res, next) => {
  try {
    const days = Number(req.query.days ?? 30);
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const alerts = await inventoryService.expiryAlerts(pharmacyId, days);
    sendSuccess(res, alerts, "Expiry alerts loaded");
  } catch (error) {
    next(error);
  }
});

inventoryRouter.post("/bulk-import", requirePermission("inventory:write"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError("CSV file is required", 400, ErrorCode.VALIDATION_001);
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const summary = await inventoryService.bulkImport(pharmacyId, req.file.buffer);
    sendSuccess(res, summary, "Bulk import completed", 201);
  } catch (error) {
    next(error);
  }
});

inventoryRouter.get("/export", requirePermission("inventory:read"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const csv = await inventoryService.exportInventoryCsv(pharmacyId);
    res.header("Content-Type", "text/csv");
    res.attachment("inventory.csv");
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

inventoryRouter.get("/:id", requirePermission("inventory:read"), async (req, res, next) => {
  try {
    const medicine = await prisma.medicine.findFirst({
      where: { id: routeParam(req, "id"), pharmacyId: req.user?.pharmacyId, isActive: true },
      include: { billItems: { take: 10, orderBy: { id: "desc" } }, poItems: { take: 10 } }
    });
    if (!medicine) throw new AppError("Medicine not found", 404, ErrorCode.INV_001);
    sendSuccess(res, medicine, "Medicine detail loaded");
  } catch (error) {
    next(error);
  }
});

inventoryRouter.put("/:id", requirePermission("inventory:write"), validate(updateMedicineSchema), async (req, res, next) => {
  try {
    const input = updateMedicineSchema.parse(req.body);
    const medicine = await prisma.medicine.update({
      where: { id: routeParam(req, "id"), pharmacyId: req.user?.pharmacyId },
      data: input
    });
    await audit({
      pharmacyId: req.user?.pharmacyId ?? "",
      userId: req.user?.id,
      action: "inventory.update",
      entity: "Medicine",
      entityId: medicine.id,
      metadata: input,
      ip: req.ip
    });
    sendSuccess(res, medicine, "Medicine updated");
  } catch (error) {
    next(error);
  }
});

inventoryRouter.delete("/:id", requirePermission("inventory:delete"), async (req, res, next) => {
  try {
    const medicine = await prisma.medicine.update({
      where: { id: routeParam(req, "id"), pharmacyId: req.user?.pharmacyId },
      data: { isActive: false }
    });
    await audit({
      pharmacyId: req.user?.pharmacyId ?? "",
      userId: req.user?.id,
      action: "inventory.delete",
      entity: "Medicine",
      entityId: medicine.id,
      ip: req.ip
    });
    sendSuccess(res, medicine, "Medicine deleted");
  } catch (error) {
    next(error);
  }
});
