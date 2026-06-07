import { expect, test } from "@playwright/test";

test("login page renders", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page.getByPlaceholder("Email address")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
});

test("public landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Your Pharmacy. Fully Digital.")).toBeVisible();
});
