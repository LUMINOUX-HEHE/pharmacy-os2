import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Pharmacy
 *     description: Pharmacy dashboard summary and operational metrics.
 */

import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api-response.js";

export const pharmacyRouter = Router();

pharmacyRouter.use(authenticate);

pharmacyRouter.get("/dashboard", async (req, res, next) => {
  try {
    const pharmacyId = req.user?.pharmacyId ?? "";
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [todayBills, ordersToday, lowStockAlerts, expiryAlerts, revenueTrend, topItems, recentBills] =
      await prisma.$transaction([
        prisma.bill.findMany({ where: { pharmacyId, createdAt: { gte: startOfDay }, status: { not: "VOID" } } }),
        prisma.order.count({ where: { pharmacyId, createdAt: { gte: startOfDay } } }),
        prisma.medicine.count({ where: { pharmacyId, isActive: true, stockQty: { lte: 10 } } }),
        prisma.medicine.count({ where: { pharmacyId, isActive: true, expiryDate: { lte: inThirtyDays } } }),
        prisma.analyticsSnapshot.findMany({
          where: { pharmacyId, date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          orderBy: { date: "asc" }
        }),
        prisma.billItem.groupBy({
          by: ["medicineId"],
          where: { bill: { pharmacyId } },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 10
        }),
        prisma.bill.findMany({ where: { pharmacyId }, orderBy: { createdAt: "desc" }, take: 8 })
      ]);

    const medicines = await prisma.medicine.findMany({ where: { id: { in: topItems.map((item) => item.medicineId) } } });
    sendSuccess(res, {
      revenueToday: todayBills.reduce((sum, bill) => sum + bill.totalAmount, 0),
      ordersToday,
      lowStockAlerts,
      expiryAlerts,
      revenueTrend: revenueTrend.map((snapshot) => ({ date: snapshot.date, revenue: snapshot.revenue })),
      topMedicines: topItems.map((item) => ({
        name: medicines.find((medicine) => medicine.id === item.medicineId)?.name ?? "Unknown",
        quantity: item._sum?.quantity ?? 0
      })),
      recentActivity: recentBills.map((bill) => ({
        id: bill.id,
        label: `Bill ${bill.billNo} created`,
        createdAt: bill.createdAt
      }))
    }, "Dashboard loaded");
  } catch (error) {
    next(error);
  }
});
