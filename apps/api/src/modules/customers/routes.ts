import { ErrorCode } from "@pharmacy-os/types";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Customers
 *     description: Customer CRM, credit ledger, reminders, and payment-link workflows.
 */


import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validation.js";
import { sendPaginated, sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { routeParam } from "../../utils/request.js";

import { customersService } from "./customers.service.js";
import { customerQuerySchema, customerSchema, ledgerSchema } from "./schemas.js";

export const customersRouter = Router();

customersRouter.use(authenticate);

customersRouter.get("/", requirePermission("customers:read"), validate(customerQuerySchema, "query"), async (req, res, next) => {
  try {
    const query = customerQuerySchema.parse(req.query);
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const result = await customersService.listCustomers(pharmacyId, query);
    sendPaginated(res, result, "Customers loaded");
  } catch (error) {
    next(error);
  }
});

customersRouter.post("/", requirePermission("customers:write"), validate(customerSchema), async (req, res, next) => {
  try {
    const input = customerSchema.parse(req.body);
    const customer = await prisma.customer.create({
      data: {
        ...input,
        pharmacyId: req.user?.pharmacyId ?? ""
      }
    });
    sendSuccess(res, customer, "Customer created", 201);
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/:id", requirePermission("customers:read"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const customer = await customersService.getCustomer(pharmacyId, routeParam(req, "id"));
    sendSuccess(res, customer, "Customer loaded");
  } catch (error) {
    next(error);
  }
});

customersRouter.put("/:id", requirePermission("customers:write"), validate(customerSchema.partial()), async (req, res, next) => {
  try {
    const input = customerSchema.partial().parse(req.body);
    const customer = await prisma.customer.update({ where: { id: routeParam(req, "id") }, data: input });
    sendSuccess(res, customer, "Customer updated");
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/:id/ledger", requirePermission("customers:read"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const customer = await customersService.getCustomer(pharmacyId, routeParam(req, "id"));
    sendSuccess(res, customer.creditLedger, "Credit ledger loaded");
  } catch (error) {
    next(error);
  }
});

customersRouter.post("/:id/ledger", requirePermission("customers:write"), validate(ledgerSchema), async (req, res, next) => {
  try {
    const input = ledgerSchema.parse(req.body);
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const result = await customersService.addLedgerEntry(pharmacyId, routeParam(req, "id"), input);
    sendSuccess(res, result, "Ledger entry added", 201);
  } catch (error) {
    next(error);
  }
});

customersRouter.post("/:id/payment-link", requirePermission("customers:write"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const link = await customersService.createPaymentLink(pharmacyId, routeParam(req, "id"));
    sendSuccess(res, link, "Payment link sent");
  } catch (error) {
    next(error);
  }
});
