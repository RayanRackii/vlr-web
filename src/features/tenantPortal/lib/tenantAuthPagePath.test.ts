import { describe, expect, it } from "vitest"

import { isTenantAuthPagePath } from "./tenantAuthPagePath"

describe("isTenantAuthPagePath", () => {
  it.each([
    "/t/acme",
    "/t/acme/",
    "/t/acme/register",
    "/t/acme/register/",
    "/t/acme/verify-email",
    "/t/acme/forgot-password",
    "/t/acme/forgot-password/confirm",
    "/",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/forgot-password/confirm/",
  ])("matches auth page %s", (path) => {
    expect(isTenantAuthPagePath(path)).toBe(true)
  })

  it.each([
    "/t/acme/app",
    "/t/acme/app/perfil",
    "/t/acme/agenda",
    "/t/acme/agenda/123",
    "/t/acme/catalogo",
    "/t/acme/unknown",
    "/app",
    "/agenda",
    "/t/acme/register/extra",
    "/t",
  ])("does not match %s", (path) => {
    expect(isTenantAuthPagePath(path)).toBe(false)
  })
})
