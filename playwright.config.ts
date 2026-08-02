import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "wide",
      use: { ...devices["Desktop Chrome"], viewport: { width: 2560, height: 1440 } }
    },
    { name: "phone", use: { ...devices["Pixel 7"] } }
  ],
  webServer: {
    command:
      "VITE_SETUP_SERVICE_URL=http://127.0.0.1:4173/test-setup-service/ npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
