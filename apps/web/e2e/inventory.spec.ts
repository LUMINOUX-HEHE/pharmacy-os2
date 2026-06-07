import { expect, test } from "@playwright/test";

import { login, navigateApp } from "./helpers";

test("add medicine, edit stock, and verify it in the table", async ({ page }) => {
  await login(page);
  await navigateApp(page, "Inventory");
  await expect(page.getByRole("heading", { name: "Inventory Management" })).toBeVisible();

  const suffix = Date.now().toString(36).toUpperCase();
  const medicineName = `E2E Test Medicine ${suffix}`;
  const sku = `E2E-${suffix}`;

  await page.getByRole("button", { name: /Add Medicine/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Medicine Name").fill(medicineName);
  await dialog.getByPlaceholder("Generic name").fill("Paracetamol");
  await dialog.getByPlaceholder("SKU").fill(sku);
  await dialog.getByPlaceholder("Manufacturer").fill("E2E Pharma");
  await dialog.getByPlaceholder("Batch No.").fill(`B-${suffix}`);
  await dialog.getByPlaceholder("MRP (Rs)").fill("42");
  await dialog.getByPlaceholder("Purchase price (Rs)").fill("28");
  await dialog.getByPlaceholder("GST %").fill("12");
  await dialog.getByPlaceholder("HSN code").fill("3004");
  await dialog.getByPlaceholder("Stock Qty").fill("18");
  await dialog.getByPlaceholder("Reorder Level").fill("5");
  await dialog.getByRole("button", { name: "Save" }).click();

  await page.locator("main").getByPlaceholder("Search").fill(sku);
  await expect(page.getByText(medicineName)).toBeVisible();
  await expect(page.getByText("18")).toBeVisible();

  await page.getByRole("button", { name: "Edit medicine" }).click();
  await dialog.getByPlaceholder("Stock Qty").fill("31");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText(medicineName)).toBeVisible();
  await expect(page.getByText("31")).toBeVisible();
});
