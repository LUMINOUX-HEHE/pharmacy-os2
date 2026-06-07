import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js";
import { sendWhatsApp } from "../utils/whatsapp.js";

import { reorderAlertQueue } from "./queues.js";

export const registerReorderAlertJob = (): void => {
  reorderAlertQueue.process("check", async (job) => {
    const payload = job.data as { pharmacyId: string; medicineIds: string[] };
    const medicines = await prisma.medicine.findMany({
      where: { pharmacyId: payload.pharmacyId, id: { in: payload.medicineIds }, isActive: true }
    });
    const lowStock = medicines.filter((medicine) => medicine.stockQty < medicine.reorderLevel);

    for (const medicine of lowStock) {
      await prisma.notification.create({
        data: {
          pharmacyId: payload.pharmacyId,
          type: "LOW_STOCK",
          title: `${medicine.name} needs reorder`,
          message: `Current stock is ${medicine.stockQty}. Reorder level is ${medicine.reorderLevel}.`,
          metadata: { medicineId: medicine.id, sku: medicine.sku }
        }
      });
    }

    const owner = await prisma.user.findFirst({
      where: { pharmacyId: payload.pharmacyId, role: "OWNER" },
      include: { pharmacy: true }
    });
    if (owner?.pharmacy?.phone && lowStock.length > 0) {
      await sendWhatsApp({
        to: owner.pharmacy.phone,
        body: `Low stock alert: ${lowStock.length} medicines need reorder. Open Pharmacy OS to review.`
      });
    }

    logger.info("Reorder alert job completed", { pharmacyId: payload.pharmacyId, alerts: lowStock.length });
    return { alerts: lowStock.length };
  });
};
