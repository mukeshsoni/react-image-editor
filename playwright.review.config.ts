import { defineConfig } from "@playwright/test";

import baseline from "./playwright.config";

export default defineConfig({
  ...baseline,
  testDir: "./review-e2e",
  outputDir: "test-results/review",
  reporter: [["dot"], ["html", { open: "never", outputFolder: "playwright-report/review" }]],
  use: { ...baseline.use, baseURL: "http://127.0.0.1:4177" },
  webServer: {
    command: "npx vite --config e2e/vite.config.ts --port 4177 --strictPort",
    url: "http://127.0.0.1:4177", reuseExistingServer: false, timeout: 60_000,
  },
});
