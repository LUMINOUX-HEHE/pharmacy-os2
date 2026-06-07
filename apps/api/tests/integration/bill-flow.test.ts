import { expect, it } from "@jest/globals";
import request from "supertest";

import { prisma } from "../../src/config/prisma.js";
import { describeIfDatabase, loginOwner, testMedicinePayload } from "../helpers.js";

describeIfDatabase("bill creation flow", () => {
  it("creates a bill, deducts stock, downloads PDF, voids bill, and restores stock", async () => {
    const { app, token } = await loginOwner();
    const createdMedicine = await request(app)
      .post("/api/v1/inventory")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...testMedicinePayload(), stockQty: 6, reorderLevel: 2 })
      .expect(201);
    const medicine = createdMedicine.body.data as { id: string; stockQty: number };

    const response = await request(app)
      .post("/api/v1/billing/bills")
      .set("Authorization", `Bearer ${token}`)
      .send({
        patientName: "Test Patient",
        patientPhone: "+919999999999",
        paymentMode: "CASH",
        items: [{ medicineId: medicine.id, quantity: 1, discount: 0 }]
      })
      .expect(201);
    const bill = response.body.data as { id: string; subtotal: number; gstAmount: number; discount: number; totalAmount: number; items: { medicineId: string; quantity: number }[] };

    expect(response.body.success).toBe(true);
    expect(bill.items).toHaveLength(1);
    expect(bill.subtotal + bill.gstAmount - bill.discount).toBe(bill.totalAmount);

    const deducted = await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } });
    expect(deducted.stockQty).toBe(5);

    const pdf = await request(app).get(`/api/v1/billing/bills/${bill.id}/pdf`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(Buffer.isBuffer(pdf.body)).toBe(true);
    expect(pdf.body.length).toBeGreaterThan(1000);

    await request(app).delete(`/api/v1/billing/bills/${bill.id}`).set("Authorization", `Bearer ${token}`).expect(200);
    const restored = await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } });
    expect(restored.stockQty).toBe(medicine.stockQty);
  });
});
