import { expect, test, type Page } from "@playwright/test";

import { login, navigateApp } from "./helpers";

const createBillingMedicine = async (page: Page) => {
  const suffix = Date.now().toString(36).toUpperCase();
  const token = await page.evaluate(() => localStorage.getItem("pharmacy-os-access-token"));
  expect(token).toEqual(expect.any(String));

  const medicineName = `E2E Billing Medicine ${suffix}`;
  const response = await page.request.post("/api/v1/inventory", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: medicineName,
      genericName: "Paracetamol",
      sku: `BILL-${suffix}`,
      category: "TABLET",
      manufacturer: "E2E Pharma",
      batchNo: `B-${suffix}`,
      expiryDate: "2028-12-31T00:00:00.000Z",
      mfgDate: "2026-01-01T00:00:00.000Z",
      mrp: 4200,
      purchasePrice: 2800,
      gstRate: 12,
      hsnCode: "3004",
      stockQty: 12,
      reorderLevel: 3,
      scheduleType: "GENERAL",
      barcodeId: null,
      isOnline: true,
      onlinePrice: null
    }
  });

  expect(response.ok()).toBeTruthy();
  return medicineName;
};

test("add medicine to cart, complete bill, and verify PDF request", async ({ page }) => {
  await login(page);
  const medicineName = await createBillingMedicine(page);
  await navigateApp(page, "Billing");
  await expect(page.getByRole("heading", { name: "Billing & POS" })).toBeVisible();

  await page.getByPlaceholder("Search by medicine, barcode, or SKU").fill(medicineName);
  await page.getByRole("button", { name: new RegExp(medicineName, "i") }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Remove ${medicineName}`, "i") })).toBeVisible();

  await page.getByPlaceholder("Patient name").fill("E2E Billing Patient");
  await page.getByPlaceholder("Phone").fill("+919812340099");

  const pdfResponse = page.waitForResponse((response) => {
    const url = response.url();
    return url.includes("/api/v1/billing/bills/") && url.endsWith("/pdf") && response.status() === 200;
  });
  await page.getByRole("button", { name: /Save Bill/i }).click();
  const response = await pdfResponse;

  expect(response.headers()["content-type"]).toContain("application/pdf");
});
