import { ErrorCode } from "@pharmacy-os/types";
import type { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

import type { driverSchema } from "./schemas.js";

type DriverInput = z.infer<typeof driverSchema>;

const coordsForAddress = (address: string | null | undefined, index: number): { lat: number; lng: number } => {
  if (address) {
    try {
      const parsed = JSON.parse(address) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "lat" in parsed &&
        "lng" in parsed &&
        typeof parsed.lat === "number" &&
        typeof parsed.lng === "number"
      ) {
        return { lat: parsed.lat, lng: parsed.lng };
      }
    } catch {
      // Plain-text addresses are common in the current schema.
    }
  }

  return {
    lat: 19.076 + index * 0.004,
    lng: 72.8777 + index * 0.004
  };
};

export const deliveryService = {
  listDrivers(pharmacyId: string) {
    return prisma.deliveryDriver.findMany({
      where: { pharmacyId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });
  },

  async getDriver(pharmacyId: string, driverId: string) {
    const driver = await prisma.deliveryDriver.findFirst({ where: { id: driverId, pharmacyId } });
    if (!driver) throw new AppError("Delivery driver not found", 404, ErrorCode.ORDER_001);
    return driver;
  },

  createDriver(pharmacyId: string, input: DriverInput) {
    return prisma.deliveryDriver.create({
      data: { ...input, pharmacyId }
    });
  },

  async updateDriver(pharmacyId: string, driverId: string, input: Partial<DriverInput>) {
    await this.getDriver(pharmacyId, driverId);
    return prisma.deliveryDriver.update({ where: { id: driverId }, data: input });
  },

  async deleteDriver(pharmacyId: string, driverId: string) {
    await this.getDriver(pharmacyId, driverId);
    return prisma.deliveryDriver.update({ where: { id: driverId }, data: { isActive: false } });
  },

  async liveDeliveries(pharmacyId: string) {
    const orders = await prisma.order.findMany({
      where: {
        pharmacyId,
        status: "OUT_FOR_DELIVERY"
      },
      include: { customer: true, deliveryDriver: true, delivery: true, items: true },
      orderBy: { updatedAt: "desc" }
    });

    return orders.map((order, index) => ({
      orderId: order.id,
      status: order.status,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      customerAddress: order.customer.address,
      customerCoords: coordsForAddress(order.customer.address, index),
      driverId: order.deliveryDriverId,
      driverName: order.deliveryDriver?.name ?? null,
      driverPhone: order.deliveryDriver?.phone ?? null,
      assignedAt: order.delivery?.assignedAt ?? null,
      itemsCount: order.items.length,
      total: order.total
    }));
  },

  history(pharmacyId: string) {
    return prisma.delivery.findMany({
      where: { order: { pharmacyId }, status: "DELIVERED" },
      include: { driver: true, order: { include: { customer: true } } },
      orderBy: { deliveredAt: "desc" },
      take: 100
    });
  }
};
