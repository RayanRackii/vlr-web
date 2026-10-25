import { describe, expect, it } from "vitest"

import { formatTenantTimeZoneLabel } from "@/features/tenantPortal/lib/tenantTimeZoneLabel"

describe("formatTenantTimeZoneLabel", () => {
  it("names the city from the IANA zone and includes the GMT offset", () => {
    const label = formatTenantTimeZoneLabel("America/Manaus", "pt-BR")
    expect(label).toContain("Manaus")
    expect(label).toMatch(/GMT-4/)
  })

  it("replaces underscores in multi-word city names", () => {
    const label = formatTenantTimeZoneLabel("America/Sao_Paulo", "pt-BR")
    expect(label).toContain("Sao Paulo")
  })

  it("falls back to the default tenant zone for an invalid id", () => {
    const label = formatTenantTimeZoneLabel("Not/AZone", "pt-BR")
    expect(label).toContain("Sao Paulo")
  })

  it("renders in the requested locale regardless of the active app language", () => {
    const en = formatTenantTimeZoneLabel("America/Manaus", "en")
    const es = formatTenantTimeZoneLabel("America/Manaus", "es")
    expect(en.toLowerCase()).toContain("manaus")
    expect(es.toLowerCase()).toContain("manaus")
    expect(en).not.toBe(es)
  })

  it("uses the displayed instant to resolve a DST-aware offset", () => {
    expect(
      formatTenantTimeZoneLabel("America/New_York", "en", "2026-01-15T12:00:00Z"),
    ).toContain("GMT-5")
    expect(
      formatTenantTimeZoneLabel("America/New_York", "en", "2026-07-15T12:00:00Z"),
    ).toContain("GMT-4")
  })
})
