import request from "supertest";

import { prisma } from "../src/config/prisma.js";

export const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

export const appPromise = import("../src/app.js").then((module) => module.app);

export const loginOwner = async () => {
  const app = await appPromise;
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "admin@demo.com", password: "Demo@1234", rememberMe: true })
    .expect(200);
  const cookieHeader = response.headers["set-cookie"];
  const cookie = Array.isArray(cookieHeader) ? cookieHeader : typeof cookieHeader === "string" ? [cookieHeader] : [];
  return { app, token: response.body.data.accessToken as string, cookie };
};

export const seededPharmacy = () => prisma.pharmacy.findUniqueOrThrow({ where: { slug: "sharma-medical" } });

export const uniqueTestSku = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

export const testMedicinePayload = (sku = uniqueTestSku("TST-MED")) => ({
  name: `Test Medicine ${sku.slice(-6)}`,
  genericName: "Paracetamol",
  sku,
  category: "TABLET" as const,
  manufacturer: "Test Pharma",
  batchNo: `B-${sku.slice(-6)}`,
  expiryDate: new Date("2028-12-31T00:00:00.000Z").toISOString(),
  mfgDate: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  mrp: 10000,
  purchasePrice: 6000,
  gstRate: 12 as const,
  hsnCode: "3004",
  stockQty: 10,
  reorderLevel: 3,
  scheduleType: "GENERAL" as const,
  barcodeId: null,
  isOnline: true,
  onlinePrice: null
});
