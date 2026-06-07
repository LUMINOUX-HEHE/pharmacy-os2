import { ErrorCode } from "@pharmacy-os/types";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Analytics
 *     description: Revenue, inventory, customer analytics, tax reports, and export jobs.
 */

import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";

import { analyticsService } from "./analytics.service.js";

export const analyticsRouter = Router();

analyticsRouter.use(authenticate, requirePermission("analytics:read"));

analyticsRouter.get("/revenue", async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const revenue = await analyticsService.revenue(pharmacyId, req.query);
    sendSuccess(res, revenue, "Revenue analytics loaded");
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/inventory", async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const inventory = await analyticsService.inventory(pharmacyId, req.query);
    sendSuccess(res, inventory, "Inventory analytics loaded");
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/customers", async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const customers = await analyticsService.customers(pharmacyId, req.query);
    sendSuccess(res, customers, "Customer analytics loaded");
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/reports/gstr1", async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const gstr1 = await analyticsService.gstr1(pharmacyId, req.query);
    sendSuccess(res, gstr1, "GSTR-1 data loaded");
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/reports/stock", async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const stock = await analyticsService.stockReport(pharmacyId);
    sendSuccess(res, stock, "Stock valuation loaded");
  } catch (error) {
    next(error);
  }
});

analyticsRouter.post("/reports/export", async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const dateRange = analyticsService.dateRangeFromQuery(req.body as Record<string, unknown>);
    const report = await analyticsService.enqueueReport({
      pharmacyId,
      userId: req.user?.id,
      reportType: typeof req.body.reportType === "string" ? req.body.reportType : "sales-summary",
      dateRange
    });
    sendSuccess(res, report, report.jobId ? "Report export queued" : "Report export deferred until Redis is available", 202);
  } catch (error) {
    next(error);
  }
});
