import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js";
import { calculateReminderNextSendAt } from "../modules/reminders/reminders.service.js";
import { sendWhatsApp } from "../utils/whatsapp.js";

import { addQueueJob, reminderQueue } from "./queues.js";

export const registerReminderJob = (): void => {
  reminderQueue.process("daily", async () => {
    const dueReminders = await prisma.reminder.findMany({
      where: { isActive: true, nextSendAt: { lte: new Date() } },
      include: { customer: true, medicine: true }
    });

    for (const reminder of dueReminders) {
      const body = `Refill reminder: ${reminder.medicine.name} is due. Reply to reorder from your pharmacy.`;
      try {
        const result = await sendWhatsApp({ to: reminder.customer.phone, body });
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            lastSentAt: new Date(),
            nextSendAt: calculateReminderNextSendAt(new Date(), reminder.frequency),
            logs: {
              create: {
                status: "SENT",
                providerId: result.providerId,
                message: body
              }
            }
          }
        });
        console.info(`Reminder sent: ${reminder.id}`);
        logger.info("Reminder sent", { reminderId: reminder.id, pharmacyId: reminder.pharmacyId });
      } catch (error) {
        await prisma.reminderLog.create({
          data: {
            reminderId: reminder.id,
            status: "FAILED",
            message: error instanceof Error ? error.message : "Reminder send failed"
          }
        });
        logger.error("Reminder send failed", { reminderId: reminder.id, message: error instanceof Error ? error.message : String(error) });
      }
    }

    return { processed: dueReminders.length };
  });

  void addQueueJob(reminderQueue, "daily", {}, { repeat: { cron: "0 9 * * *", tz: "Asia/Kolkata" } });
};
