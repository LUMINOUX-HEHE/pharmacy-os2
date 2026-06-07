import { ErrorCode } from "@pharmacy-os/types";
import { createPagination, getPaginationParams } from "@pharmacy-os/utils";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Billing
 *     description: POS billing, bill history, PDF invoices, payment status, and bill voiding.
 */

import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validation.js";
import { emitToPharmacy } from "../../sockets/index.js";
import { sendPaginated, sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { createPaymentOrder } from "../../utils/payments.js";
import { routeParam } from "../../utils/request.js";

import { billingService } from "./billing.service.js";
import { billQuerySchema, createBillSchema, paymentUpdateSchema, razorpayOrderSchema } from "./schemas.js";

export const billingRouter = Router();

billingRouter.use(authenticate);

billingRouter.post("/bills", requirePermission("billing:write"), validate(createBillSchema), async (req, res, next) => {
  try {
    const input = createBillSchema.parse(req.body);
    const pharmacyId = req.user?.pharmacyId;
    const userId = req.user?.id;
    if (!pharmacyId || !userId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);

    const bill = await billingService.createBill(input, { pharmacyId, userId, ip: req.ip });
    emitToPharmacy(pharmacyId, "billing:created", { id: bill.id, billNo: bill.billNo, totalAmount: bill.totalAmount });
    sendSuccess(res, bill, "Bill created", 201);
  } catch (error) {
    next(error);
  }
});

billingRouter.post(
  "/payments/razorpay-order",
  requirePermission("billing:write"),
  validate(razorpayOrderSchema),
  async (req, res, next) => {
    try {
      const input = razorpayOrderSchema.parse(req.body);
      const pharmacyId = req.user?.pharmacyId;
      if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
      const order = await createPaymentOrder({
        amount: input.amount,
        receipt: input.receipt ?? `bill-upi-${pharmacyId}-${Date.now()}`,
        notes: { type: "billing-upi", pharmacyId }
      });
      sendSuccess(res, order, "Razorpay order created", 201);
    } catch (error) {
      next(error);
    }
  }
);

billingRouter.get("/bills", requirePermission("billing:read"), validate(billQuerySchema, "query"), async (req, res, next) => {
  try {
    const query = billQuerySchema.parse(req.query);
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);
    const where = {
      pharmacyId: req.user?.pharmacyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentMode ? { paymentMode: query.paymentMode } : {}),
      ...(query.search
        ? {
            OR: [
              { billNo: { contains: query.search, mode: "insensitive" as const } },
              { patientName: { contains: query.search, mode: "insensitive" as const } },
              { patientPhone: { contains: query.search, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              gte: query.from,
              lte: query.to
            }
          }
        : {})
    };
    const [data, total] = await prisma.$transaction([
      prisma.bill.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, include: { items: true } }),
      prisma.bill.count({ where })
    ]);
    sendPaginated(res, createPagination(data, total, page, limit), "Bills loaded");
  } catch (error) {
    next(error);
  }
});

billingRouter.get("/bills/:id", requirePermission("billing:read"), async (req, res, next) => {
  try {
    const bill = await prisma.bill.findFirst({
      where: { id: routeParam(req, "id"), pharmacyId: req.user?.pharmacyId },
      include: { items: { include: { medicine: true } }, creator: true }
    });
    if (!bill) throw new AppError("Bill not found", 404, ErrorCode.BILL_001);
    sendSuccess(res, bill, "Bill loaded");
  } catch (error) {
    next(error);
  }
});

billingRouter.put(
  "/bills/:id/payment",
  requirePermission("billing:write"),
  validate(paymentUpdateSchema),
  async (req, res, next) => {
    try {
      const input = paymentUpdateSchema.parse(req.body);
      const bill = await prisma.bill.update({
        where: { id: routeParam(req, "id") },
        data: {
          status: input.status,
          paymentMode: input.paymentMode
        }
      });
      sendSuccess(res, bill, "Payment status updated");
    } catch (error) {
      next(error);
    }
  }
);

billingRouter.get("/bills/:id/pdf", requirePermission("billing:read"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const { billNo, pdf } = await billingService.createBillPdf(pharmacyId, routeParam(req, "id"), req.query.copy === "duplicate");
    res.header("Content-Type", "application/pdf");
    res.attachment(`${billNo}.pdf`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

billingRouter.delete("/bills/:id", requirePermission("billing:delete"), async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    if (!pharmacyId) throw new AppError("Authentication required", 401, ErrorCode.AUTH_001);
    const voided = await billingService.voidBill({
      pharmacyId,
      billId: routeParam(req, "id"),
      userId: req.user?.id,
      ip: req.ip
    });
    sendSuccess(res, voided, "Bill voided and stock restored");
  } catch (error) {
    next(error);
  }
});
