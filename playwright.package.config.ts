import process from "node:process";

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/specs",
  outputDir: "test-results/package",
  testMatch: "**/package.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["dot"], ["html", { open: "never", outputFolder: "playwright-report/package" }]],
  use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 }, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "react-18-package", use: { baseURL: "http://127.0.0.1:4175" } },
    { name: "react-19-package", use: { baseURL: "http://127.0.0.1:4176" } },
  ],
  webServer: [18, 19].map((version, index) => ({
    command: `npx vite --config e2e/vite.config.ts --port ${4175 + index} --strictPort`,
    env: { E2E_REACT_VERSION: String(version) },
    url: `http://127.0.0.1:${4175 + index}`,
    reuseExistingServer: false,
    timeout: 60_000,
  })),
});
