import { ErrorCode } from "@pharmacy-os/types";
import type { Medicine } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { addQueueJob, reportGenerationQueue } from "../../jobs/queues.js";
import { AppError } from "../../utils/app-error.js";

type GroupBy = "day" | "week" | "month";

interface DateRange {
  startDate: Date;
  endDate: Date;
}

const parseDate = (value: unknown, fallback: Date): Date => {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid date: ${value}`, 400, ErrorCode.VALIDATION_001);
  }
  return date;
};

const dateRangeFromQuery = (query: Record<string, unknown>, defaultDays = 30): DateRange => {
  const endFallback = new Date();
  const startFallback = new Date(endFallback.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  const startDate = parseDate(query.startDate, startFallback);
  const endDate = parseDate(query.endDate, endFallback);
  endDate.setHours(23, 59, 59, 999);
  if (startDate > endDate) {
    throw new AppError("startDate must be before endDate", 400, ErrorCode.VALIDATION_001);
  }
  return { startDate, endDate };
};

const groupByFromQuery = (value: unknown): GroupBy => (value === "week" || value === "month" ? value : "day");

const periodKey = (date: Date, groupBy: GroupBy): string => {
  const period = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (groupBy === "week") {
    const day = period.getUTCDay() || 7;
    period.setUTCDate(period.getUTCDate() - day + 1);
  }
  if (groupBy === "month") {
    period.setUTCDate(1);
  }
  return period.toISOString().slice(0, 10);
};

const billDateWhere = (pharmacyId: string, range: DateRange) => ({
  pharmacyId,
  status: { not: "VOID" as const },
  createdAt: { gte: range.startDate, lte: range.endDate }
});

const taxableFor = (item: { mrp: number; quantity: number; discount: number }): number =>
  Math.max(0, item.mrp * item.quantity - item.discount);

export const analyticsService = {
  dateRangeFromQuery,

  async revenue(pharmacyId: string, query: Record<string, unknown>) {
    const range = dateRangeFromQuery(query);
    const groupBy = groupByFromQuery(query.groupBy);
    const bills = await prisma.bill.findMany({
      where: billDateWhere(pharmacyId, range),
      orderBy: { createdAt: "asc" }
    });

    const grouped = new Map<string, { date: string; revenue: number; ordersCount: number }>();
    for (const bill of bills) {
      const key = periodKey(bill.createdAt, groupBy);
      const current = grouped.get(key) ?? { date: key, revenue: 0, ordersCount: 0 };
      current.revenue += bill.totalAmount;
      current.ordersCount += 1;
      grouped.set(key, current);
    }

    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
  },

  async inventory(pharmacyId: string, query: Record<string, unknown>) {
    const range = dateRangeFromQuery(query);
    const groupBy = groupByFromQuery(query.groupBy);
    const topSellingGroups = await prisma.billItem.groupBy({
      by: ["medicineId"],
      where: { bill: billDateWhere(pharmacyId, range) },
      _sum: { quantity: true, amount: true },
      _count: { medicineId: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 20
    });

    const medicines = await prisma.medicine.findMany({
      where: { pharmacyId, id: { in: topSellingGroups.map((item) => item.medicineId) } }
    });

    const deadStock = await prisma.medicine.findMany({
      where: {
        pharmacyId,
        isActive: true,
        billItems: { none: { bill: billDateWhere(pharmacyId, range) } }
      },
      orderBy: { stockQty: "desc" },
      take: 100
    });

    const expiryRiskMedicines = await prisma.medicine.findMany({
      where: {
        pharmacyId,
        isActive: true,
        stockQty: { gt: 0 },
        expiryDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
      }
    });
    const soldItems = await prisma.billItem.findMany({
      where: { bill: billDateWhere(pharmacyId, range) },
      include: { medicine: true, bill: { select: { createdAt: true } } }
    });

    const categoryMap = new Map<string, { category: string; revenue: number; quantity: number }>();
    const profitMap = new Map<string, { date: string; grossRevenue: number; netProfit: number }>();
    for (const item of soldItems) {
      const category = item.medicine.category;
      const categoryCurrent = categoryMap.get(category) ?? { category, revenue: 0, quantity: 0 };
      categoryCurrent.revenue += item.amount;
      categoryCurrent.quantity += item.quantity;
      categoryMap.set(category, categoryCurrent);

      const date = periodKey(item.bill.createdAt, groupBy);
      const profitCurrent = profitMap.get(date) ?? { date, grossRevenue: 0, netProfit: 0 };
      profitCurrent.grossRevenue += item.amount;
      profitCurrent.netProfit += item.amount - item.medicine.purchasePrice * item.quantity;
      profitMap.set(date, profitCurrent);
    }

    return {
      topSellingSkus: topSellingGroups.map((item) => {
        const medicine = medicines.find((candidate) => candidate.id === item.medicineId) ?? null;
        return {
          medicineId: item.medicineId,
          sku: medicine?.sku ?? null,
          name: medicine?.name ?? null,
          quantitySold: item._sum.quantity ?? 0,
          billsCount: item._count.medicineId,
          revenue: item._sum.amount ?? 0,
          medicine
        };
      }),
      deadStock,
      expiryRiskValue: expiryRiskMedicines.reduce((sum, medicine) => sum + medicine.mrp * medicine.stockQty, 0),
      expiryRiskMedicines,
      revenueByCategory: Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue),
      profitByDate: Array.from(profitMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    };
  },

  async customers(pharmacyId: string, query: Record<string, unknown>) {
    const range = dateRangeFromQuery(query);
    const [newCustomers, billsInRange, billsBeforeRange, customers] = await Promise.all([
      prisma.customer.count({ where: { pharmacyId, createdAt: { gte: range.startDate, lte: range.endDate } } }),
      prisma.bill.findMany({ where: billDateWhere(pharmacyId, range), orderBy: { createdAt: "asc" } }),
      prisma.bill.findMany({
        where: { pharmacyId, status: { not: "VOID" }, createdAt: { lt: range.startDate } },
        select: { patientPhone: true }
      }),
      prisma.customer.findMany({ where: { pharmacyId } })
    ]);

    const previousPhones = new Set(billsBeforeRange.map((bill) => bill.patientPhone).filter(Boolean));
    const rangePhones = new Set(billsInRange.map((bill) => bill.patientPhone).filter(Boolean));
    const returningCustomers = Array.from(rangePhones).filter((phone) => previousPhones.has(phone)).length;
    const averageTransactionValue =
      billsInRange.length > 0
        ? Math.round(billsInRange.reduce((sum, bill) => sum + bill.totalAmount, 0) / billsInRange.length)
        : 0;

    const spendByPhone = new Map<string, number>();
    for (const bill of billsInRange) {
      if (!bill.patientPhone) continue;
      spendByPhone.set(bill.patientPhone, (spendByPhone.get(bill.patientPhone) ?? 0) + bill.totalAmount);
    }

    const topCustomers = Array.from(spendByPhone.entries())
      .map(([phone, totalSpend]) => ({
        customer: customers.find((customer) => customer.phone === phone) ?? null,
        phone,
        totalSpend
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10);

    return {
      newCustomers,
      returningCustomers,
      averageTransactionValue,
      topCustomers
    };
  },

  async gstr1(pharmacyId: string, query: Record<string, unknown>) {
    const month = Number(query.month ?? new Date().getMonth() + 1);
    const year = Number(query.year ?? new Date().getFullYear());
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
      throw new AppError("month and year must be valid", 400, ErrorCode.VALIDATION_001);
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const bills = await prisma.bill.findMany({
      where: billDateWhere(pharmacyId, { startDate, endDate }),
      include: { items: true }
    });

    const grouped = new Map<number, { gstRate: number; taxableValue: number; taxCollected: number; billsCount: number }>();
    for (const bill of bills) {
      for (const item of bill.items) {
        const taxableValue = taxableFor(item);
        const taxCollected = Math.round((taxableValue * item.gstRate) / 100);
        const current = grouped.get(item.gstRate) ?? { gstRate: item.gstRate, taxableValue: 0, taxCollected: 0, billsCount: 0 };
        current.taxableValue += taxableValue;
        current.taxCollected += taxCollected;
        current.billsCount += 1;
        grouped.set(item.gstRate, current);
      }
    }

    return {
      month,
      year,
      rates: Array.from(grouped.values()).sort((a, b) => a.gstRate - b.gstRate)
    };
  },

  async stockReport(pharmacyId: string): Promise<{ valuation: number; medicines: Medicine[] }> {
    const medicines = await prisma.medicine.findMany({ where: { pharmacyId, isActive: true } });
    return {
      valuation: medicines.reduce((sum, medicine) => sum + medicine.purchasePrice * medicine.stockQty, 0),
      medicines
    };
  },

  async enqueueReport(input: {
    pharmacyId: string;
    userId?: string;
    reportType: string;
    dateRange: DateRange;
  }): Promise<{ jobId: string | null }> {
    const job = await addQueueJob(reportGenerationQueue, "generate", {
      reportType: input.reportType,
      pharmacyId: input.pharmacyId,
      dateRange: {
        startDate: input.dateRange.startDate.toISOString(),
        endDate: input.dateRange.endDate.toISOString()
      },
      userId: input.userId
    });
    return { jobId: job ? String(job.id) : null };
  }
};
