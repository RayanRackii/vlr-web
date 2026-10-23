import { describe, expect, it } from "vitest"

import { adminManifest } from "@/features/admin/manifest"

describe("platform admin routes", () => {
  it("redirects the exact tenants index to the platform dashboard", () => {
    const tenantsIndexRoute = adminManifest.routes.platformStandalone.find(
      (route) => route.path === "/admin/tenants",
    )

    expect(tenantsIndexRoute?.element.props).toMatchObject({
      to: "/admin/dashboard",
      replace: true,
    })
  })
})
