import { ErrorCode } from "@pharmacy-os/types";
import type { OrderStatus } from "@prisma/client";

import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { emitToPharmacy } from "../../sockets/index.js";
import { AppError } from "../../utils/app-error.js";
import { audit } from "../../utils/audit.js";
import { sendWhatsApp } from "../../utils/whatsapp.js";

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED"],
  CONFIRMED: ["PREPARING"],
  PREPARING: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: []
};

const statusLabel = (status: OrderStatus): string => status.replaceAll("_", " ").toLowerCase();

export const ordersService = {
  async updateStatus(input: { pharmacyId: string; orderId: string; status: OrderStatus; note?: string }) {
    const order = await prisma.order.findFirst({
      where: { id: input.orderId, pharmacyId: input.pharmacyId },
      include: { delivery: true }
    });
    if (!order) throw new AppError("Order not found", 404, ErrorCode.ORDER_001);

    if (!allowedTransitions[order.status].includes(input.status)) {
      throw new AppError(`Invalid status transition from ${order.status} to ${input.status}`, 409, ErrorCode.ORDER_001);
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: input.status,
        timeline: {
          create: {
            status: input.status,
            note: input.note ?? `Order moved to ${input.status}`
          }
        },
        ...(input.status === "DELIVERED" && order.delivery
          ? {
              delivery: {
                update: {
                  status: "DELIVERED",
                  deliveredAt: new Date()
                }
              }
            }
          : {})
      },
      include: { customer: true, items: { include: { medicine: true } }, delivery: true, deliveryDriver: true, timeline: true }
    });

    emitToPharmacy(input.pharmacyId, "order:status_update", { orderId: updated.id, status: updated.status });
    return updated;
  },

  async assignDriver(input: { pharmacyId: string; orderId: string; driverId: string }) {
    const [order, driver] = await Promise.all([
      prisma.order.findFirst({ where: { id: input.orderId, pharmacyId: input.pharmacyId }, select: { id: true, pharmacyId: true } }),
      prisma.deliveryDriver.findFirst({ where: { id: input.driverId, pharmacyId: input.pharmacyId, isActive: true } })
    ]);
    if (!order) throw new AppError("Order not found", 404, ErrorCode.ORDER_001);
    if (!driver) throw new AppError("Delivery driver not found", 404, ErrorCode.ORDER_001);

    const assignedAt = new Date();
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        deliveryDriverId: driver.id,
        delivery: {
          upsert: {
            create: { driverId: driver.id, status: "ASSIGNED", assignedAt },
            update: { driverId: driver.id, status: "ASSIGNED", assignedAt, deliveredAt: null }
          }
        }
      },
      include: { deliveryDriver: true, delivery: true, customer: true, items: true }
    });

    emitToPharmacy(input.pharmacyId, "delivery:location", {
      orderId: updated.id,
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      assignedAt: updated.delivery?.assignedAt ?? assignedAt,
      location: null
    });

    return updated;
  },

  async notifyCustomer(input: { pharmacyId: string; orderId: string; userId?: string; ip?: string }) {
    const order = await prisma.order.findFirst({
      where: { id: input.orderId, pharmacyId: input.pharmacyId },
      include: { customer: true, pharmacy: true }
    });
    if (!order) throw new AppError("Order not found", 404, ErrorCode.ORDER_001);

    const trackingUrl = `${env.STOREFRONT_URL}/store/${order.pharmacy.slug}/orders/${order.id}`;
    const body = `Your order #${order.id} from ${order.pharmacy.name} is now ${statusLabel(order.status)}. Track: ${trackingUrl}`;
    const result = await sendWhatsApp({ to: order.customer.phone, body });

    await audit({
      pharmacyId: input.pharmacyId,
      userId: input.userId,
      action: "orders.notify",
      entity: "Order",
      entityId: order.id,
      metadata: { providerId: result.providerId, status: order.status, trackingUrl },
      ip: input.ip
    });

    return { ...result, to: order.customer.phone, message: body };
  }
};
