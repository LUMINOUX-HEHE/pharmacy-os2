import { afterEach, expect, it, jest } from "@jest/globals";
import type { Job } from "bull";

import { prisma } from "../../src/config/prisma.js";
import { reorderAlertQueue } from "../../src/jobs/queues.js";
import { billingService } from "../../src/modules/billing/billing.service.js";
import { inventoryService } from "../../src/modules/inventory/inventory.service.js";
import { describeIfDatabase, seededPharmacy, testMedicinePayload } from "../helpers.js";

describeIfDatabase("inventory deduction", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("decrements stock and triggers reorder alert checks on bill creation", async () => {
    const pharmacy = await seededPharmacy();
    const owner = await prisma.user.findFirstOrThrow({ where: { email: "admin@demo.com" } });
    const medicine = await prisma.medicine.findFirstOrThrow({ where: { pharmacyId: pharmacy.id, isActive: true } });
    await prisma.medicine.update({ where: { id: medicine.id }, data: { stockQty: 2, reorderLevel: 2 } });
    const spy = jest.spyOn(inventoryService, "handleStockDeductionAlerts").mockResolvedValue(undefined);

    await billingService.createBill(
      {
        patientName: "Inventory Test",
        patientPhone: "+919812345678",
        doctorName: null,
        prescriptionUrl: null,
        paymentMode: "CASH",
        discount: 0,
        items: [{ medicineId: medicine.id, quantity: 1, discount: 0 }]
      },
      { pharmacyId: pharmacy.id, userId: owner.id }
    );

    const updated = await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } });
    expect(updated.stockQty).toBe(1);
    expect(spy).toHaveBeenCalledWith(pharmacy.id, [medicine.id]);
  });

  it("throws when stock is insufficient", async () => {
    const pharmacy = await seededPharmacy();
    const owner = await prisma.user.findFirstOrThrow({ where: { email: "admin@demo.com" } });
    const medicine = await prisma.medicine.findFirstOrThrow({ where: { pharmacyId: pharmacy.id, isActive: true } });
    await prisma.medicine.update({ where: { id: medicine.id }, data: { stockQty: 0 } });

    await expect(
      billingService.createBill(
        {
          patientName: "Inventory Test",
          patientPhone: "+919812345679",
          doctorName: null,
          prescriptionUrl: null,
          paymentMode: "CASH",
          discount: 0,
          items: [{ medicineId: medicine.id, quantity: 1, discount: 0 }]
        },
        { pharmacyId: pharmacy.id, userId: owner.id }
      )
    ).rejects.toThrow(/insufficient stock/i);
  });

  it("queues a reorder alert when stock falls below reorder level", async () => {
    const pharmacy = await seededPharmacy();
    const medicine = await prisma.medicine.create({
      data: { ...testMedicinePayload(), pharmacyId: pharmacy.id, stockQty: 1, reorderLevel: 5 }
    });
    const addSpy = jest
      .spyOn(reorderAlertQueue, "add")
      .mockResolvedValue({ id: "reorder-test-job" } as unknown as Job<unknown>);

    await inventoryService.handleStockDeductionAlerts(pharmacy.id, [medicine.id]);

    expect(addSpy).toHaveBeenCalledWith("check", {
      pharmacyId: pharmacy.id,
      medicineIds: [medicine.id]
    }, undefined);
  });
});
