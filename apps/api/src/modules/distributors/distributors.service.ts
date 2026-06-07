import { ErrorCode } from "@pharmacy-os/types";
import { formatCurrency } from "@pharmacy-os/utils";

import { prisma } from "../../config/prisma.js";
import { emitToPharmacy } from "../../sockets/index.js";
import { AppError } from "../../utils/app-error.js";
import { audit } from "../../utils/audit.js";
import { sendEmail } from "../../utils/mailer.js";
import { sendWhatsApp } from "../../utils/whatsapp.js";

const poNumber = (id: string): string => `PO-${id.slice(-6).toUpperCase()}`;

const poEmailTemplate = (po: Awaited<ReturnType<typeof loadPurchaseOrder>>) => {
  if (!po) throw new AppError("Purchase order not found", 404, ErrorCode.INV_001);
  const rows = po.items
    .map(
      (item) =>
        `<tr><td>${item.medicine.name}</td><td>${item.medicine.sku}</td><td>${item.quantity}</td><td>${formatCurrency(item.purchasePrice)}</td><td>${formatCurrency(item.purchasePrice * item.quantity)}</td></tr>`
    )
    .join("");
  const textItems = po.items
    .map((item) => `${item.medicine.name} (${item.medicine.sku}) - Qty ${item.quantity} - ${formatCurrency(item.purchasePrice * item.quantity)}`)
    .join("\n");

  return {
    subject: `${poNumber(po.id)} from ${po.pharmacy.name}`,
    html: `
      <p>Hello ${po.distributor.contactPerson},</p>
      <p>Please process purchase order <strong>${poNumber(po.id)}</strong>.</p>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead><tr><th>Medicine</th><th>SKU</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p><strong>Total: ${formatCurrency(po.totalAmount)}</strong></p>
    `,
    text: [
      `Purchase order ${poNumber(po.id)} from ${po.pharmacy.name}`,
      "",
      textItems,
      "",
      `Total: ${formatCurrency(po.totalAmount)}`
    ].join("\n")
  };
};

const loadPurchaseOrder = (pharmacyId: string, poId: string) =>
  prisma.purchaseOrder.findFirst({
    where: { id: poId, pharmacyId },
    include: { pharmacy: true, distributor: true, items: { include: { medicine: true } } }
  });

export const distributorsService = {
  async sendPurchaseOrder(input: { pharmacyId: string; poId: string; userId?: string; ip?: string }) {
    const po = await loadPurchaseOrder(input.pharmacyId, input.poId);
    if (!po) throw new AppError("Purchase order not found", 404, ErrorCode.INV_001);
    if (po.status === "RECEIVED") throw new AppError("Received purchase orders cannot be resent", 409, ErrorCode.INV_001);

    const template = poEmailTemplate(po);
    await sendEmail({
      to: po.distributor.email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });

    try {
      await sendWhatsApp({
        to: po.distributor.phone,
        body: `${template.subject}: ${po.items.length} items, total ${formatCurrency(po.totalAmount)}. Please check email for details.`
      });
    } catch {
      // WhatsApp is optional for distributors; email is the source of truth for sending the PO.
    }

    const sent = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "SENT", sentAt: new Date() },
      include: { distributor: true, items: { include: { medicine: true } } }
    });

    await audit({
      pharmacyId: input.pharmacyId,
      userId: input.userId,
      action: "purchaseOrder.send",
      entity: "PurchaseOrder",
      entityId: po.id,
      metadata: { distributorId: po.distributorId, totalAmount: po.totalAmount },
      ip: input.ip
    });

    return sent;
  },

  async receivePurchaseOrder(input: { pharmacyId: string; poId: string; userId?: string; ip?: string }) {
    const po = await loadPurchaseOrder(input.pharmacyId, input.poId);
    if (!po) throw new AppError("Purchase order not found", 404, ErrorCode.INV_001);
    if (po.status === "RECEIVED") throw new AppError("Purchase order already received", 409, ErrorCode.INV_001);

    const updatedMedicines = await prisma.$transaction(async (tx) => {
      const medicines = [];
      for (const item of po.items) {
        const medicine = await tx.medicine.update({
          where: { id: item.medicineId },
          data: { stockQty: { increment: item.quantity }, purchasePrice: item.purchasePrice }
        });
        medicines.push({ medicine, quantity: item.quantity });
        await tx.auditLog.create({
          data: {
            pharmacyId: input.pharmacyId,
            userId: input.userId,
            action: "inventory.stock_add",
            entity: "Medicine",
            entityId: item.medicineId,
            metadata: {
              purchaseOrderId: po.id,
              quantity: item.quantity,
              purchasePrice: item.purchasePrice
            },
            ip: input.ip
          }
        });
      }

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: "RECEIVED", receivedAt: new Date() }
      });
      return medicines;
    });

    for (const item of updatedMedicines) {
      emitToPharmacy(input.pharmacyId, "stock:updated", {
        medicineId: item.medicine.id,
        name: item.medicine.name,
        stockQty: item.medicine.stockQty,
        addedQty: item.quantity
      });
    }

    return loadPurchaseOrder(input.pharmacyId, po.id);
  }
};
