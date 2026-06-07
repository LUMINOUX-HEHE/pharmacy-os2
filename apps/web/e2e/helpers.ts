import { expect, type Page } from "@playwright/test";

export const login = async (page: Page) => {
  await page.goto("/auth/login");
  await page.getByPlaceholder("Email address").fill("admin@demo.com");
  await page.getByPlaceholder("Password").fill("Demo@1234");
  await page.getByRole("button", { name: "Welcome back" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
};

export const navigateApp = async (page: Page, name: string) => {
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  if (await openNavigation.isVisible()) {
    await openNavigation.click();
  }

  await page.getByRole("link", { name, exact: true }).click();
};
