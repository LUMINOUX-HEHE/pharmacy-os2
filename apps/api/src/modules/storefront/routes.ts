import { ErrorCode } from "@pharmacy-os/types";
import { Router } from "express";

/**
 * @swagger
 * tags:
 *   - name: Storefront
 *     description: Public pharmacy storefront catalogue, prescription uploads, checkout, and tracking.
 */


import { prisma } from "../../config/prisma.js";
import { emitToPharmacy } from "../../sockets/index.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { uploadMulterFileToCloudinary } from "../../utils/cloudinary-upload.js";
import { createPaymentOrder } from "../../utils/payments.js";
import { routeParam } from "../../utils/request.js";
import { upload } from "../../utils/upload.js";

import { storefrontOrderSchema } from "./schemas.js";

export const storefrontRouter = Router();

storefrontRouter.get("/:slug", async (req, res, next) => {
  try {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { slug: routeParam(req, "slug") },
      include: {
        storeSetting: true,
        medicines: {
          where: { isOnline: true, isActive: true, stockQty: { gt: 0 } },
          orderBy: { name: "asc" },
          take: 50
        }
      }
    });
    if (!pharmacy?.storeSetting?.enabled) {
      throw new AppError("Storefront not found", 404, ErrorCode.ORDER_001);
    }
    sendSuccess(res, pharmacy, "Storefront loaded");
  } catch (error) {
    next(error);
  }
});

storefrontRouter.get("/:slug/medicines", async (req, res, next) => {
  try {
    const pharmacy = await prisma.pharmacy.findUnique({ where: { slug: routeParam(req, "slug") } });
    if (!pharmacy) throw new AppError("Storefront not found", 404, ErrorCode.ORDER_001);
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const category = typeof req.query.category === "string" && req.query.category ? req.query.category : undefined;
    const medicines = await prisma.medicine.findMany({
      where: {
        pharmacyId: pharmacy.id,
        isOnline: true,
        isActive: true,
        stockQty: { gt: 0 },
        ...(category ? { category: category as never } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { genericName: { contains: search, mode: "insensitive" as const } },
                { manufacturer: { contains: search, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: { name: "asc" },
      take: 100
    });
    sendSuccess(res, medicines, "Catalogue loaded");
  } catch (error) {
    next(error);
  }
});

storefrontRouter.post("/:slug/prescription", upload.single("file"), async (req, res, next) => {
  try {
    const pharmacy = await prisma.pharmacy.findUnique({ where: { slug: routeParam(req, "slug") } });
    if (!pharmacy) throw new AppError("Storefront not found", 404, ErrorCode.ORDER_001);
    if (!req.file) throw new AppError("Prescription file is required", 400, ErrorCode.VALIDATION_001);
    const url = await uploadMulterFileToCloudinary(req.file, `pharmacy-os/public-prescriptions/${pharmacy.slug}`);
    sendSuccess(res, { url }, "Prescription uploaded", 201);
  } catch (error) {
    next(error);
  }
});

storefrontRouter.post("/:slug/orders", async (req, res, next) => {
  try {
    const input = storefrontOrderSchema.parse(req.body);
    if (!/^\d{6}$/.test(input.otp)) throw new AppError("Invalid OTP", 401, ErrorCode.AUTH_001);

    const pharmacy = await prisma.pharmacy.findUnique({ where: { slug: routeParam(req, "slug") }, include: { storeSetting: true } });
    if (!pharmacy?.storeSetting?.enabled) throw new AppError("Storefront not found", 404, ErrorCode.ORDER_001);

    const medicines = await prisma.medicine.findMany({
      where: { id: { in: input.items.map((item) => item.medicineId) }, pharmacyId: pharmacy.id, isOnline: true }
    });
    const subtotal = input.items.reduce((sum, item) => {
      const medicine = medicines.find((m) => m.id === item.medicineId);
      if (!medicine) throw new AppError("Medicine unavailable", 400, ErrorCode.ORDER_001);
      return sum + (medicine.onlinePrice ?? medicine.mrp) * item.quantity;
    }, 0);
    const deliveryFee = pharmacy.storeSetting.deliveryFee;
    const total = subtotal + deliveryFee;
    const paymentOrder =
      input.paymentMode === "CASH"
        ? null
        : await createPaymentOrder({
            amount: total,
            receipt: `store-${pharmacy.slug}-${Date.now()}`,
            notes: { pharmacyId: pharmacy.id, slug: pharmacy.slug }
          });

    const order = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { pharmacyId_phone: { pharmacyId: pharmacy.id, phone: input.phone } },
        update: { name: input.customerName, address: input.address },
        create: {
          pharmacyId: pharmacy.id,
          name: input.customerName,
          phone: input.phone,
          address: input.address,
          tags: ["Online"]
        }
      });

      const created = await tx.order.create({
        data: {
          pharmacyId: pharmacy.id,
          customerId: customer.id,
          subtotal,
          deliveryFee,
          total,
          paymentMode: input.paymentMode,
          paymentStatus: input.paymentMode === "CASH" ? "PENDING" : "PENDING",
          razorpayOrderId: paymentOrder?.id,
          prescriptionUrl: input.prescriptionUrl,
          notes: `Delivery to ${input.address}`,
          items: {
            create: input.items.map((item) => {
              const medicine = medicines.find((m) => m.id === item.medicineId);
              if (!medicine) throw new AppError("Medicine unavailable", 400, ErrorCode.ORDER_001);
              return {
                medicineId: item.medicineId,
                quantity: item.quantity,
                price: medicine.onlinePrice ?? medicine.mrp
              };
            })
          },
          timeline: {
            create: {
              status: "NEW",
              note: "Order placed from public storefront"
            }
          }
        },
        include: { items: true, customer: true, timeline: true }
      });

      await Promise.all(
        input.items.map((item) =>
          tx.medicine.update({ where: { id: item.medicineId }, data: { stockQty: { decrement: item.quantity } } })
        )
      );
      return created;
    });

    emitToPharmacy(pharmacy.id, "order:new", { orderId: order.id, order });
    sendSuccess(res, { ...order, razorpay: paymentOrder }, "Order placed", 201);
  } catch (error) {
    next(error);
  }
});

storefrontRouter.get("/:slug/orders/:id", async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: routeParam(req, "id"), pharmacy: { slug: routeParam(req, "slug") } },
      include: { items: { include: { medicine: true } }, timeline: true, deliveryDriver: true }
    });
    if (!order) throw new AppError("Order not found", 404, ErrorCode.ORDER_001);
    sendSuccess(res, order, "Order tracking loaded");
  } catch (error) {
    next(error);
  }
});
