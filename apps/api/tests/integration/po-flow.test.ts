import { expect, it } from "@jest/globals";
import request from "supertest";

import { prisma } from "../../src/config/prisma.js";
import { describeIfDatabase, loginOwner, testMedicinePayload, uniqueTestSku } from "../helpers.js";

describeIfDatabase("purchase order flow", () => {
  it("creates, sends, receives a purchase order, and increments stock", async () => {
    const { app, token } = await loginOwner();
    const medicineResponse = await request(app)
      .post("/api/v1/inventory")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...testMedicinePayload(uniqueTestSku("PO-MED")), stockQty: 4, purchasePrice: 4500 })
      .expect(201);
    const medicine = medicineResponse.body.data as { id: string; stockQty: number };

    const distributorResponse = await request(app)
      .post("/api/v1/distributors")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `PO Distributor ${Date.now()}`,
        contactPerson: "Priya Shah",
        phone: "+919812345000",
        email: `po-${Date.now()}@example.com`,
        categories: ["TABLET"],
        gstin: "27AABCU9603R1ZX"
      })
      .expect(201);
    const distributor = distributorResponse.body.data as { id: string };

    const poResponse = await request(app)
      .post("/api/v1/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        distributorId: distributor.id,
        notes: "Integration replenishment",
        items: [{ medicineId: medicine.id, quantity: 7, purchasePrice: 4500 }]
      })
      .expect(201);
    const purchaseOrder = poResponse.body.data as { id: string; totalAmount: number; status: string };
    expect(purchaseOrder.status).toBe("DRAFT");
    expect(purchaseOrder.totalAmount).toBe(31500);

    const sent = await request(app)
      .put(`/api/v1/purchase-orders/${purchaseOrder.id}/send`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(sent.body.data.status).toBe("SENT");

    const received = await request(app)
      .post(`/api/v1/purchase-orders/${purchaseOrder.id}/receive`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(received.body.data.status).toBe("RECEIVED");

    const updatedMedicine = await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } });
    expect(updatedMedicine.stockQty).toBe(medicine.stockQty + 7);
    expect(updatedMedicine.purchasePrice).toBe(4500);
  });
});
