import crypto from "node:crypto";

import { env } from "../config/env.js";
import { razorpay } from "../config/razorpay.js";

export const createPaymentOrder = async (input: {
  amount: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string; devMode: boolean }> => {
  const currency = input.currency ?? "INR";

  if (!razorpay) {
    return {
      id: `order_dev_${crypto.randomBytes(8).toString("hex")}`,
      amount: input.amount,
      currency,
      devMode: true
    };
  }

  const order = await razorpay.orders.create({
    amount: input.amount,
    currency,
    receipt: input.receipt,
    notes: input.notes
  });

  return {
    id: order.id,
    amount: Number(order.amount),
    currency: String(order.currency),
    devMode: false
  };
};

export const createPaymentLink = async (input: {
  amount: number;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
  };
  description: string;
  referenceId: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; url: string; amount: number; currency: string; devMode: boolean }> => {
  const currency = "INR";

  if (!razorpay) {
    const id = `plink_dev_${crypto.randomBytes(8).toString("hex")}`;
    return {
      id,
      url: `${env.FRONTEND_URL}/payments/${id}`,
      amount: input.amount,
      currency,
      devMode: true
    };
  }

  const link = await razorpay.paymentLink.create({
    amount: input.amount,
    currency,
    accept_partial: false,
    description: input.description,
    reference_id: input.referenceId,
    customer: {
      name: input.customer.name,
      contact: input.customer.phone,
      ...(input.customer.email ? { email: input.customer.email } : {})
    },
    notify: { sms: false, email: false, whatsapp: false },
    reminder_enable: true,
    notes: input.notes
  });

  return {
    id: link.id,
    url: link.short_url,
    amount: Number(link.amount),
    currency: link.currency ?? currency,
    devMode: false
  };
};

export const verifyRazorpaySignature = (input: {
  rawBody: Buffer;
  signature: string;
  secret: string;
}): boolean => {
  const expected = crypto.createHmac("sha256", input.secret).update(input.rawBody).digest("hex");
  if (expected.length !== input.signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
};
