import { describe, expect, it } from "vitest"

import {
  tenantPortalHref,
  tenantPortalPath,
  tenantPortalPathMode,
} from "@/features/tenantPortal/services/tenantPortalService"

describe("tenantPortalPath slug", () => {
  it("keeps a lowercase [a-z0-9-]+ slug in the path", () => {
    expect(tenantPortalPath("FICC")).toBe("/t/ficc")
    expect(tenantPortalPath("  Clube-1  ", "register")).toBe(
      "/t/clube-1/register",
    )
    expect(tenantPortalPathMode("a-b-1", "app")).toBe("/t/a-b-1/app")
  })

  it("drops a slug outside [a-z0-9-]+ instead of putting it in the path", () => {
    expect(tenantPortalPath("ficc/../../admin")).toBe("/")
    expect(tenantPortalPath("ficc.evil.com", "app")).toBe("/")
    expect(tenantPortalPath("bad slug")).toBe("/")
    expect(tenantPortalPath("ficc_club", "register")).toBe("/")
    expect(tenantPortalPath("")).toBe("/")
    expect(tenantPortalPathMode("../etc", "app")).toBe("/")
  })

  it("does not place an invalid slug in an absolute portal URL", () => {
    expect(
      tenantPortalHref("ficc.evil.com", "app", {
        hostname: "rolvix.com.br",
        origin: "https://rolvix.com.br",
      }),
    ).toBe("https://rolvix.com.br/")
    expect(
      tenantPortalHref("../etc", "", {
        hostname: "localhost",
        origin: "http://localhost:5173",
      }),
    ).toBe("http://localhost:5173/")
    expect(
      tenantPortalHref("FICC", "app", {
        hostname: "localhost",
        origin: "http://localhost:5173",
      }),
    ).toBe("http://localhost:5173/t/ficc/app")
  })
})
