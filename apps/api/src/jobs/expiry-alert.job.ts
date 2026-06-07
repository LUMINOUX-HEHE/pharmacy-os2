import { formatDate } from "@pharmacy-os/utils";

import { cacheKeys, redis } from "../config/redis.js";
import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js";
import { sendEmail } from "../utils/mailer.js";

import { addQueueJob, expiryAlertQueue } from "./queues.js";

const localExpiryAlerts = new Map<string, number>();
const sevenDaysSeconds = 7 * 24 * 60 * 60;

const shouldSkipAlert = async (pharmacyId: string, bucket: string): Promise<boolean> => {
  const key = cacheKeys.lastExpiryAlert(pharmacyId, bucket);
  const localExpiry = localExpiryAlerts.get(key);
  if (localExpiry && localExpiry > Date.now()) return true;

  if (redis.status === "ready") {
    const exists = await redis.get(key);
    if (exists) return true;
    await redis.set(key, "sent", "EX", sevenDaysSeconds);
    return false;
  }

  localExpiryAlerts.set(key, Date.now() + sevenDaysSeconds * 1000);
  return false;
};

export const registerExpiryAlertJob = (): void => {
  expiryAlertQueue.process("daily", async () => {
    const now = new Date();
    const buckets = [7, 14, 30];
    let createdAlerts = 0;

    for (const days of buckets) {
      const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const medicines = await prisma.medicine.findMany({
        where: {
          isActive: true,
          stockQty: { gt: 0 },
          expiryDate: { gte: now, lte: threshold }
        },
        include: { pharmacy: true },
        orderBy: { expiryDate: "asc" }
      });

      const byPharmacy = new Map<string, typeof medicines>();
      for (const medicine of medicines) {
        byPharmacy.set(medicine.pharmacyId, [...(byPharmacy.get(medicine.pharmacyId) ?? []), medicine]);
      }

      for (const [pharmacyId, group] of byPharmacy) {
        if (await shouldSkipAlert(pharmacyId, String(days))) continue;
        await prisma.notification.create({
          data: {
            pharmacyId,
            type: "EXPIRY",
            title: `Medicines expiring within ${days} days`,
            message: `${group.length} medicines expire by ${formatDate(threshold)}.`,
            metadata: { bucketDays: days, medicineIds: group.map((medicine) => medicine.id) }
          }
        });
        createdAlerts += 1;

        const owner = await prisma.user.findFirst({ where: { pharmacyId, role: "OWNER" } });
        if (owner) {
          const lines = group.slice(0, 25).map((medicine) => `${medicine.name} (${medicine.sku}) - ${formatDate(medicine.expiryDate)}`);
          await sendEmail({
            to: owner.email,
            subject: `Pharmacy OS expiry digest: ${days} days`,
            html: `<p>${group.length} medicines expire within ${days} days.</p><pre>${lines.join("\n")}</pre>`,
            text: `${group.length} medicines expire within ${days} days.\n${lines.join("\n")}`
          });
        }
      }
    }

    logger.info("Expiry alert job completed", { createdAlerts });
    return { createdAlerts };
  });

  void addQueueJob(expiryAlertQueue, "daily", {}, { repeat: { cron: "0 8 * * *", tz: "Asia/Kolkata" } });
};
