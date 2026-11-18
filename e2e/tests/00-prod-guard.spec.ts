import { test, expect } from "@playwright/test"

import { loadE2eEnv } from "../env"

test.describe("prod guard", () => {
  test("targets the DEV Preview and the Fly DEV API", () => {
    const env = loadE2eEnv()
    expect(env.envName).toBe("development")
    expect(env.webUrl).toBe(
      "https://vlr-web-git-develop-vlr-solutions.vercel.app",
    )
    expect(env.apiUrl).toBe("https://rolvix-api-dev.fly.dev")
    expect(env.webUrl).not.toContain("rolvix.com.br")
    expect(env.apiUrl).not.toContain("rolvix.com.br")
    expect(env.apiUrl).not.toContain("rolvix-api-prod")
  })
})
