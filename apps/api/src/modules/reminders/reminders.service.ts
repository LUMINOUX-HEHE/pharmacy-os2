import { ErrorCode } from "@pharmacy-os/types";
import type { ReminderFrequency } from "@prisma/client";
import type { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { sendWhatsApp } from "../../utils/whatsapp.js";

import type { reminderSchema } from "./schemas.js";

type ReminderInput = z.infer<typeof reminderSchema>;

export const calculateReminderNextSendAt = (from: Date, frequency: ReminderFrequency): Date => {
  const days = frequency === "WEEKLY" ? 7 : frequency === "MONTHLY" ? 30 : 90;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
};

export const remindersService = {
  async createReminder(pharmacyId: string, input: ReminderInput) {
    const [customer, medicine] = await Promise.all([
      prisma.customer.findFirst({ where: { id: input.customerId, pharmacyId }, select: { id: true } }),
      prisma.medicine.findFirst({ where: { id: input.medicineId, pharmacyId, isActive: true }, select: { id: true } })
    ]);
    if (!customer) throw new AppError("Customer not found", 404, ErrorCode.CUSTOMER_001);
    if (!medicine) throw new AppError("Medicine not found", 404, ErrorCode.INV_001);

    return prisma.reminder.create({
      data: {
        customerId: input.customerId,
        medicineId: input.medicineId,
        frequency: input.frequency,
        isActive: input.isActive,
        pharmacyId,
        nextSendAt: calculateReminderNextSendAt(new Date(), input.frequency)
      },
      include: { customer: true, medicine: true }
    });
  },

  async sendNow(pharmacyId: string, reminderId: string) {
    const reminder = await prisma.reminder.findFirst({
      where: { id: reminderId, pharmacyId },
      include: { customer: true, medicine: true }
    });
    if (!reminder) throw new AppError("Reminder not found", 404, ErrorCode.CUSTOMER_001);

    const body = `Reminder from your pharmacy: please refill ${reminder.medicine.name}.`;
    try {
      const result = await sendWhatsApp({ to: reminder.customer.phone, body });
      return prisma.reminder.update({
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
        },
        include: { customer: true, medicine: true, logs: { orderBy: { createdAt: "desc" }, take: 5 } }
      });
    } catch (error) {
      await prisma.reminderLog.create({
        data: {
          reminderId: reminder.id,
          status: "FAILED",
          message: error instanceof Error ? error.message : "WhatsApp send failed"
        }
      });
      throw new AppError("Reminder WhatsApp send failed", 502, ErrorCode.SYSTEM_001);
    }
  }
};
