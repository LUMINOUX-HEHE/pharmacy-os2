import { MedicineCategory, ScheduleType } from "@pharmacy-os/types";
import { describe, expect, it } from "vitest";

import { medicineFormSchema } from "../pages/app/inventory-schema";
import { loginSchema, signupSchema } from "../pages/auth/auth-schemas";
import { contactFormSchema } from "../pages/public/contact-schema";

describe("form validation schemas", () => {
  it("validates login credentials", () => {
    expect(loginSchema.safeParse({ email: "admin@demo.com", password: "Demo@1234", remember: true }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "not-an-email", password: "", remember: true }).success).toBe(false);
  });

  it("validates signup onboarding data and rejects mismatched passwords", () => {
    const validSignup = {
      fullName: "Aarav Sharma",
      email: "aarav@example.com",
      password: "Demo@1234",
      confirmPassword: "Demo@1234",
      termsAccepted: true,
      pharmacyName: "Sharma Medical Store",
      licenseNo: "MH-MUM-2024-001",
      gstin: "27AABCS1429B1Z1",
      phone: "+919820001234",
      street: "Shop 12, S V Road",
      city: "Mumbai",
      state: "Maharashtra",
      pinCode: "400058",
      pharmacyType: "Independent",
      plan: "STARTER"
    };

    expect(signupSchema.safeParse(validSignup).success).toBe(true);
    expect(signupSchema.safeParse({ ...validSignup, confirmPassword: "Mismatch@123" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, termsAccepted: false }).success).toBe(false);
  });

  it("validates inventory medicine form values", () => {
    const validMedicine = {
      name: "Paracetamol 500mg",
      genericName: "Paracetamol",
      sku: "SMS-TEST-001",
      category: MedicineCategory.TABLET,
      manufacturer: "Cipla",
      batchNo: "BATCH-001",
      expiryDate: "2028-12-31",
      mfgDate: "2026-01-01",
      mrp: "35.50",
      purchasePrice: "22.25",
      gstRate: "12",
      hsnCode: "3004",
      stockQty: "25",
      reorderLevel: "10",
      scheduleType: ScheduleType.GENERAL,
      barcodeId: "8901234500001",
      isOnline: true,
      onlinePrice: ""
    };

    expect(medicineFormSchema.safeParse(validMedicine).success).toBe(true);
    expect(medicineFormSchema.safeParse({ ...validMedicine, gstRate: "28" }).success).toBe(false);
    expect(medicineFormSchema.safeParse({ ...validMedicine, stockQty: "-1" }).success).toBe(false);
  });

  it("validates contact form submissions", () => {
    expect(
      contactFormSchema.safeParse({
        name: "Priya Shah",
        email: "priya@example.com",
        pharmacyName: "Priya Medicals",
        city: "Mumbai",
        message: "Please help us migrate our inventory."
      }).success
    ).toBe(true);

    expect(
      contactFormSchema.safeParse({
        name: "P",
        email: "bad",
        pharmacyName: "A",
        city: "",
        message: "short"
      }).success
    ).toBe(false);
  });
});
