import { ErrorCode } from "@pharmacy-os/types";
import type { Bill, BillItem, Medicine, Prisma } from "@prisma/client";
import type { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { audit } from "../../utils/audit.js";
import { createInvoicePdf } from "../../utils/pdf.js";
import { inventoryService } from "../inventory/inventory.service.js";

import type { createBillSchema } from "./schemas.js";

type CreateBillInput = z.infer<typeof createBillSchema>;
type BillWithItems = Bill & { items: (BillItem & { medicine: Medicine })[] };

interface CalculatedLine {
  medicine: Medicine;
  quantity: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
}

const nextBillNo = async (tx: Prisma.TransactionClient, pharmacyId: string): Promise<string> => {
  const today = new Date();
  const prefix = `BILL-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const count = await tx.bill.count({
    where: {
      pharmacyId,
      billNo: { startsWith: prefix }
    }
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
};

const calculateLines = (input: CreateBillInput, medicines: Medicine[]): CalculatedLine[] =>
  input.items.map((item) => {
    const medicine = medicines.find((candidate) => candidate.id === item.medicineId);
    if (!medicine) {
      throw new AppError("Medicine missing", 400, ErrorCode.BILL_001);
    }

    const discountPercent = Math.min(100, Math.max(0, item.discount ?? input.discount));
    const grossAmount = medicine.mrp * item.quantity;
    const discountAmount = Math.round((grossAmount * discountPercent) / 100);
    const taxableAmount = grossAmount - discountAmount;
    const gstAmount = Math.round((taxableAmount * medicine.gstRate) / 100);

    return {
      medicine,
      quantity: item.quantity,
      discountPercent,
      discountAmount,
      taxableAmount,
      gstAmount,
      totalAmount: taxableAmount + gstAmount
    };
  });

const requestedQuantities = (input: CreateBillInput): Map<string, number> => {
  const quantities = new Map<string, number>();
  for (const item of input.items) {
    quantities.set(item.medicineId, (quantities.get(item.medicineId) ?? 0) + item.quantity);
  }
  return quantities;
};

export const billingService = {
  async createBill(input: CreateBillInput, context: { pharmacyId: string; userId: string; ip?: string }): Promise<BillWithItems> {
    if (input.idempotencyKey) {
      const existing = await prisma.bill.findUnique({
        where: { pharmacyId_idempotencyKey: { pharmacyId: context.pharmacyId, idempotencyKey: input.idempotencyKey } },
        include: { items: { include: { medicine: true } } }
      });
      if (existing) {
        return existing;
      }
    }

    const medicineIds = Array.from(new Set(input.items.map((item) => item.medicineId)));
    const medicines = await prisma.medicine.findMany({
      where: { id: { in: medicineIds }, pharmacyId: context.pharmacyId, isActive: true }
    });
    if (medicines.length !== medicineIds.length) {
      throw new AppError("One or more medicines were not found", 400, ErrorCode.BILL_001);
    }

    const quantityByMedicine = requestedQuantities(input);
    for (const medicine of medicines) {
      const requested = quantityByMedicine.get(medicine.id) ?? 0;
      if (medicine.stockQty < requested) {
        throw new AppError(`${medicine.name} has insufficient stock`, 409, ErrorCode.BILL_002);
      }
    }

    const lines = calculateLines(input, medicines);
    const subtotal = lines.reduce((sum, line) => sum + line.medicine.mrp * line.quantity, 0);
    const gstAmount = lines.reduce((sum, line) => sum + line.gstAmount, 0);
    const discount = lines.reduce((sum, line) => sum + line.discountAmount, 0);
    const totalAmount = lines.reduce((sum, line) => sum + line.totalAmount, 0);

    const bill = await prisma.$transaction(async (tx) => {
      const created = await tx.bill.create({
        data: {
          pharmacyId: context.pharmacyId,
          billNo: await nextBillNo(tx, context.pharmacyId),
          patientName: input.patientName,
          patientPhone: input.patientPhone,
          doctorName: input.doctorName,
          prescriptionUrl: input.prescriptionUrl,
          paymentMode: input.paymentMode,
          subtotal,
          gstAmount,
          discount,
          totalAmount,
          status: input.paymentMode === "CREDIT" ? "CREDIT" : "PAID",
          idempotencyKey: input.idempotencyKey,
          createdBy: context.userId,
          items: {
            create: lines.map((line) => ({
              medicineId: line.medicine.id,
              quantity: line.quantity,
              mrp: line.medicine.mrp,
              discount: line.discountAmount,
              gstRate: line.medicine.gstRate,
              amount: line.totalAmount
            }))
          }
        },
        include: { items: { include: { medicine: true } } }
      });

      for (const [medicineId, quantity] of quantityByMedicine.entries()) {
        const updated = await tx.medicine.updateMany({
          where: { id: medicineId, pharmacyId: context.pharmacyId, stockQty: { gte: quantity } },
          data: { stockQty: { decrement: quantity } }
        });
        if (updated.count !== 1) {
          throw new AppError("Stock changed while creating bill. Please retry.", 409, ErrorCode.BILL_002);
        }
      }

      if (input.paymentMode === "CREDIT" && input.patientPhone) {
        const customer = await tx.customer.upsert({
          where: { pharmacyId_phone: { pharmacyId: context.pharmacyId, phone: input.patientPhone } },
          update: {
            name: input.patientName ?? "Credit Customer",
            creditBalance: { increment: totalAmount }
          },
          create: {
            pharmacyId: context.pharmacyId,
            name: input.patientName ?? "Credit Customer",
            phone: input.patientPhone,
            creditBalance: totalAmount,
            tags: ["Credit"]
          }
        });
        await tx.creditLedger.create({
          data: {
            customerId: customer.id,
            type: "DEBIT",
            amount: totalAmount,
            description: `Credit bill ${created.billNo}`,
            billId: created.id
          }
        });
      }

      return created;
    });

    await audit({
      pharmacyId: context.pharmacyId,
      userId: context.userId,
      action: "billing.create",
      entity: "Bill",
      entityId: bill.id,
      metadata: { billNo: bill.billNo, totalAmount: bill.totalAmount },
      ip: context.ip
    });
    await inventoryService.handleStockDeductionAlerts(context.pharmacyId, medicineIds);
    return bill;
  },

  async createBillPdf(pharmacyId: string, billId: string, duplicate: boolean): Promise<{ billNo: string; pdf: Buffer }> {
    const bill = await prisma.bill.findFirst({
      where: { id: billId, pharmacyId },
      include: { items: { include: { medicine: true } }, pharmacy: true }
    });
    if (!bill) throw new AppError("Bill not found", 404, ErrorCode.BILL_001);

    return {
      billNo: bill.billNo,
      pdf: await createInvoicePdf(bill.pharmacy, bill, duplicate)
    };
  },

  async voidBill(input: { pharmacyId: string; billId: string; userId?: string; ip?: string }): Promise<Bill & { items: BillItem[] }> {
    const bill = await prisma.bill.findFirst({
      where: { id: input.billId, pharmacyId: input.pharmacyId, status: { not: "VOID" } },
      include: { items: true }
    });
    if (!bill) throw new AppError("Bill not found or already void", 404, ErrorCode.BILL_001);

    const voided = await prisma.$transaction(async (tx) => {
      for (const item of bill.items) {
        await tx.medicine.update({
          where: { id: item.medicineId },
          data: { stockQty: { increment: item.quantity } }
        });
      }
      return tx.bill.update({ where: { id: bill.id }, data: { status: "VOID" }, include: { items: true } });
    });

    await audit({
      pharmacyId: input.pharmacyId,
      userId: input.userId,
      action: "billing.void",
      entity: "Bill",
      entityId: bill.id,
      metadata: { restoredItems: bill.items.map((item) => ({ medicineId: item.medicineId, quantity: item.quantity })) },
      ip: input.ip
    });

    return voided;
  }
};
