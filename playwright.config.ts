import process from "node:process";

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/specs",
  outputDir: "test-results/source",
  testIgnore: "**/package.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["dot"], ["html", { open: "never", outputFolder: "playwright-report/source" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    colorScheme: "light",
    locale: "en-US",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } }, testIgnore: /(?:mobile|touch|package)\.spec\.ts/ },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } }, testIgnore: /(?:desktop|package)\.spec\.ts/ },
  ],
  webServer: {
    command: "npx vite --config e2e/vite.config.ts --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
