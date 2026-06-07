import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("login with demo credentials and verify dashboard loads", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  await expect(page.getByText("Today's Revenue")).toBeVisible();
});
