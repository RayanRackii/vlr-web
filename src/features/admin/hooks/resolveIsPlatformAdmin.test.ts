import { describe, expect, it } from "vitest"

import { resolveIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"

const ALLOWLIST = ["boss@rolvix.com"]

describe("resolveIsPlatformAdmin", () => {
  it("treats SUPER_ADMIN with no tenant as platform admin", () => {
    expect(
      resolveIsPlatformAdmin({
        role: "SUPER_ADMIN",
        tenantId: null,
        email: "other@example.com",
        allowlistEmails: ALLOWLIST,
      }),
    ).toBe(true)
  })

  it("treats ADMIN on the email allowlist as platform admin (enter-tenant / bootstrap)", () => {
    expect(
      resolveIsPlatformAdmin({
        role: "ADMIN",
        tenantId: "11111111-1111-4111-8111-111111111111",
        email: "boss@rolvix.com",
        allowlistEmails: ALLOWLIST,
      }),
    ).toBe(true)
  })

  it("denies a tenant Admin whose email is not on the allowlist", () => {
    expect(
      resolveIsPlatformAdmin({
        role: "ADMIN",
        tenantId: "11111111-1111-4111-8111-111111111111",
        email: "tenant-admin@clube.com",
        allowlistEmails: ALLOWLIST,
      }),
    ).toBe(false)
  })

  it("falls back to the allowlist when /me failed", () => {
    expect(
      resolveIsPlatformAdmin({
        role: undefined,
        tenantId: null,
        email: "boss@rolvix.com",
        allowlistEmails: ALLOWLIST,
        meFailed: true,
      }),
    ).toBe(true)
  })

  it("is not platform admin when /me failed and the email is not allowlisted", () => {
    expect(
      resolveIsPlatformAdmin({
        role: undefined,
        tenantId: null,
        email: "tenant-admin@clube.com",
        allowlistEmails: ALLOWLIST,
        meFailed: true,
      }),
    ).toBe(false)
  })
})
