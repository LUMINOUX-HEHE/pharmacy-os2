import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "npm --prefix ../.. --workspace @pharmacy-os/api run dev",
      url: "http://localhost:4000/health",
      reuseExistingServer: true
    },
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: true
    }
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } }
  ]
});
