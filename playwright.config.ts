import { defineConfig, devices } from "@playwright/test"

import { loadE2eEnv } from "./e2e/env"

const env = loadE2eEnv()

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  globalTimeout: 20 * 60 * 1000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: env.webUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "release",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
