import { describe, expect, it } from "vitest"

import appRoutesSource from "@/routes/AppRoutes.tsx?raw"

describe("platform admin routes", () => {
  it("redirects the exact tenants index to the platform dashboard", () => {
    expect(appRoutesSource).toMatch(
      /path="\/admin\/tenants"[\s\S]*Navigate to="\/admin\/dashboard" replace/,
    )
  })
})
