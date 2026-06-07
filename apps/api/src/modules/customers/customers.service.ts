import { ErrorCode } from "@pharmacy-os/types";
import { createPagination, formatCurrency, getPaginationParams } from "@pharmacy-os/utils";
import type { Bill, CreditLedger, Customer, Prisma } from "@prisma/client";
import type { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { createPaymentLink } from "../../utils/payments.js";
import { sendWhatsApp } from "../../utils/whatsapp.js";

import type { customerQuerySchema, ledgerSchema } from "./schemas.js";

type CustomerQuery = z.infer<typeof customerQuerySchema>;
type LedgerInput = z.infer<typeof ledgerSchema>;

type CustomerMetrics = Customer & {
  lastVisit: Date | null;
  totalSpend: number;
  creditBalance: number;
};

type LedgerWithBalance = CreditLedger & { runningBalance: number };

const normalizeFilter = (filter?: CustomerQuery["filter"]): "active" | "dormant" | "creditPending" | undefined => {
  if (!filter) return undefined;
  if (filter === "ACTIVE") return "active";
  if (filter === "DORMANT") return "dormant";
  if (filter === "CREDIT") return "creditPending";
  return filter;
};

const metricsByPhone = (bills: Bill[]): Map<string, { lastVisit: Date | null; totalSpend: number }> => {
  const metrics = new Map<string, { lastVisit: Date | null; totalSpend: number }>();
  for (const bill of bills) {
    if (!bill.patientPhone) continue;
    const current = metrics.get(bill.patientPhone) ?? { lastVisit: null, totalSpend: 0 };
    current.totalSpend += bill.totalAmount;
    if (!current.lastVisit || bill.createdAt > current.lastVisit) {
      current.lastVisit = bill.createdAt;
    }
    metrics.set(bill.patientPhone, current);
  }
  return metrics;
};

const withRunningBalance = (entries: CreditLedger[]): LedgerWithBalance[] => {
  let balance = 0;
  return entries.map((entry) => {
    balance += entry.type === "DEBIT" ? entry.amount : -entry.amount;
    return { ...entry, runningBalance: balance };
  });
};

export const customersService = {
  async listCustomers(pharmacyId: string, query: CustomerQuery) {
    const { page, limit } = getPaginationParams(query.page, query.limit);
    const where: Prisma.CustomerWhereInput = {
      pharmacyId,
      isActive: true
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search } }
      ];
    }

    if (normalizeFilter(query.filter) === "creditPending") {
      where.creditBalance = { gt: 0 };
    }

    const customers = await prisma.customer.findMany({ where, orderBy: { name: "asc" } });
    const phones = customers.map((customer) => customer.phone);
    const bills = phones.length
      ? await prisma.bill.findMany({
          where: { pharmacyId, patientPhone: { in: phones }, status: { not: "VOID" } },
          orderBy: { createdAt: "desc" }
        })
      : [];

    const metrics = metricsByPhone(bills);
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const enriched: CustomerMetrics[] = customers.map((customer) => {
      const customerMetrics = metrics.get(customer.phone) ?? { lastVisit: null, totalSpend: 0 };
      return { ...customer, ...customerMetrics };
    });

    const filter = normalizeFilter(query.filter);
    const filtered = enriched.filter((customer) => {
      if (filter === "active") return Boolean(customer.lastVisit && customer.lastVisit >= cutoff);
      if (filter === "dormant") return !customer.lastVisit || customer.lastVisit < cutoff;
      return true;
    });

    const start = (page - 1) * limit;
    return createPagination(filtered.slice(start, start + limit), filtered.length, page, limit);
  },

  async getCustomer(pharmacyId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, pharmacyId },
      include: {
        reminders: {
          where: { isActive: true, nextSendAt: { gte: new Date() } },
          include: { medicine: true },
          orderBy: { nextSendAt: "asc" }
        }
      }
    });
    if (!customer) throw new AppError("Customer not found", 404, ErrorCode.CUSTOMER_001);

    const [purchaseHistory, ledgerEntries] = await Promise.all([
      prisma.bill.findMany({
        where: { pharmacyId, patientPhone: customer.phone, status: { not: "VOID" } },
        include: { items: { include: { medicine: true } } },
        orderBy: { createdAt: "desc" },
        take: 20
      }),
      prisma.creditLedger.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "asc" }
      })
    ]);

    return {
      ...customer,
      lastVisit: purchaseHistory[0]?.createdAt ?? null,
      totalSpend: purchaseHistory.reduce((sum, bill) => sum + bill.totalAmount, 0),
      purchaseHistory,
      creditLedger: withRunningBalance(ledgerEntries),
      upcomingReminders: customer.reminders
    };
  },

  async addLedgerEntry(pharmacyId: string, customerId: string, input: LedgerInput): Promise<LedgerWithBalance> {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, pharmacyId } });
    if (!customer) throw new AppError("Customer not found", 404, ErrorCode.CUSTOMER_001);
    if (input.type === "CREDIT" && customer.creditBalance < input.amount) {
      throw new AppError("Credit entry cannot exceed outstanding balance", 400, ErrorCode.CUSTOMER_001);
    }

    await prisma.$transaction(async (tx) => {
      await tx.creditLedger.create({
        data: {
          customerId,
          type: input.type,
          amount: input.amount,
          description: input.description
        }
      });
      await tx.customer.update({
        where: { id: customerId },
        data: {
          creditBalance: input.type === "DEBIT" ? { increment: input.amount } : { decrement: input.amount }
        }
      });
    });

    const entries = await prisma.creditLedger.findMany({ where: { customerId }, orderBy: { createdAt: "asc" } });
    const withBalance = withRunningBalance(entries);
    const entry = withBalance.at(-1);
    if (!entry) throw new AppError("Ledger entry could not be loaded", 500, ErrorCode.SYSTEM_001);
    return entry;
  },

  async createPaymentLink(pharmacyId: string, customerId: string): Promise<{ url: string; id: string; amount: number; providerId: string }> {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, pharmacyId },
      include: { pharmacy: true }
    });
    if (!customer) throw new AppError("Customer not found", 404, ErrorCode.CUSTOMER_001);
    if (customer.creditBalance <= 0) {
      throw new AppError("Customer has no outstanding credit balance", 400, ErrorCode.CUSTOMER_001);
    }

    const link = await createPaymentLink({
      amount: customer.creditBalance,
      customer: { name: customer.name, phone: customer.phone, email: customer.email },
      description: `Credit balance payment for ${customer.pharmacy.name}`,
      referenceId: `credit-${customer.id}-${Date.now()}`,
      notes: { pharmacyId, customerId: customer.id }
    });

    const message = `Namaste ${customer.name}, your pending balance at ${customer.pharmacy.name} is ${formatCurrency(customer.creditBalance)}. Pay securely: ${link.url}`;
    const whatsapp = await sendWhatsApp({ to: customer.phone, body: message });

    return {
      url: link.url,
      id: link.id,
      amount: link.amount,
      providerId: whatsapp.providerId
    };
  }
};
