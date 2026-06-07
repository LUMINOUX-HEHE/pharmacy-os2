import { ErrorCode } from "@pharmacy-os/types";
import type { Request, Response, NextFunction } from "express";

import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { emitToPharmacy } from "../../sockets/index.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { verifyRazorpaySignature } from "../../utils/payments.js";

const parseRazorpayPayload = (body: unknown): {
  event?: string;
  payload?: { payment?: { entity?: { order_id?: string; id?: string; amount?: number } } };
} => (Buffer.isBuffer(body) ? JSON.parse(body.toString("utf8")) : body) as {
  event?: string;
  payload?: { payment?: { entity?: { order_id?: string; id?: string; amount?: number } } };
};

const normalizeWhatsAppStatus = (status: string): string => {
  const normalized = status.toLowerCase();
  if (["delivered", "read"].includes(normalized)) return "DELIVERED";
  if (["failed", "undelivered"].includes(normalized)) return "FAILED";
  if (normalized === "sent") return "SENT";
  return normalized.toUpperCase();
};

export const handleRazorpayWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const signature = req.headers["x-razorpay-signature"];
    if (env.RAZORPAY_WEBHOOK_SECRET) {
      if (typeof signature !== "string") {
        throw new AppError("Missing Razorpay signature", 401, ErrorCode.AUTH_003);
      }
      if (!verifyRazorpaySignature({ rawBody, signature, secret: env.RAZORPAY_WEBHOOK_SECRET })) {
        throw new AppError("Invalid Razorpay signature", 401, ErrorCode.AUTH_003);
      }
    }

    const payload = parseRazorpayPayload(req.body);
    const razorpayOrderId = payload.payload?.payment?.entity?.order_id;
    const paymentId = payload.payload?.payment?.entity?.id;
    const nextPaymentStatus =
      payload.event === "payment.captured" ? "PAID" : payload.event === "payment.failed" ? "FAILED" : null;

    if (nextPaymentStatus && razorpayOrderId) {
      const orders = await prisma.order.findMany({ where: { razorpayOrderId } });
      await prisma.order.updateMany({ where: { razorpayOrderId }, data: { paymentStatus: nextPaymentStatus } });

      await Promise.all(
        orders.map((order) =>
          prisma.notification.create({
            data: {
              pharmacyId: order.pharmacyId,
              type: "PAYMENT",
              title: nextPaymentStatus === "PAID" ? "Razorpay payment captured" : "Razorpay payment failed",
              message: `Payment ${nextPaymentStatus.toLowerCase()} for order ${order.id.slice(-6).toUpperCase()}.`,
              metadata: { razorpayOrderId, paymentId }
            }
          })
        )
      );

      orders.forEach((order) => {
        emitToPharmacy(order.pharmacyId, "order:status_update", {
          orderId: order.id,
          status: order.status,
          paymentStatus: nextPaymentStatus
        });
      });
    }

    sendSuccess(res, { received: true }, "Razorpay webhook processed");
  } catch (error) {
    next(error);
  }
};

export const handleWhatsAppWebhook = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const stringField = (value: unknown): string | undefined => {
    if (typeof value === "string") return value.trim() || undefined;
    if (typeof value === "number") return String(value);
    return undefined;
  };
  const providerId = stringField(body.MessageSid) ?? stringField(body.SmsSid) ?? stringField(body.SmsMessageSid) ?? "";
  const providerStatus = stringField(body.MessageStatus) ?? stringField(body.SmsStatus) ?? "";
  const errorCode = stringField(body.ErrorCode);

  const result = providerId
    ? await prisma.reminderLog.updateMany({
        where: { providerId },
        data: {
          status: normalizeWhatsAppStatus(providerStatus),
          ...(errorCode ? { message: `Twilio callback error ${errorCode}` } : {})
        }
      })
    : { count: 0 };

  sendSuccess(res, { received: true, updated: result.count }, "WhatsApp callback processed");
};
