import { describe, expect, it } from "vitest"

import { inspectTenantLogoSvg } from "@/features/tenantPortal/lib/inspectTenantLogoSvg"

function svg(inner: string, viewBox = "0 0 600 600"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%">${inner}</svg>`
}

describe("inspectTenantLogoSvg", () => {
  it("treats a transparent SVG as having no embedded background", () => {
    const mark = svg(
      `<circle cx="300" cy="300" r="80" fill="#22d3ee" />`,
    )

    expect(inspectTenantLogoSvg(mark)).toEqual({
      hasEmbeddedBackground: false,
      backgroundColor: null,
      backgroundIsDark: false,
      backgroundIsLight: false,
    })
  })

  it("detects a full black rect as a dark embedded background", () => {
    const mark = svg(
      `<rect width="600" height="600" fill="#000000" /><circle cx="300" cy="300" r="80" fill="#22d3ee" />`,
    )

    const inspection = inspectTenantLogoSvg(mark)
    expect(inspection.hasEmbeddedBackground).toBe(true)
    expect(inspection.backgroundIsDark).toBe(true)
    expect(inspection.backgroundIsLight).toBe(false)
  })

  it("detects a full white rect as a light embedded background", () => {
    const mark = svg(
      `<rect x="0" y="0" width="100%" height="100%" fill="#ffffff" /><path d="M280 200h40v200h-40z" fill="#0f172a" />`,
    )

    const inspection = inspectTenantLogoSvg(mark)
    expect(inspection.hasEmbeddedBackground).toBe(true)
    expect(inspection.backgroundIsLight).toBe(true)
    expect(inspection.backgroundIsDark).toBe(false)
  })

  it("does not treat a dark icon on a transparent SVG as a background", () => {
    const mark = svg(
      `<path d="M220 180h160v240H220z" fill="#0f172a" />`,
    )

    expect(inspectTenantLogoSvg(mark).hasEmbeddedBackground).toBe(false)
  })

  it("detects a simple covering path as a background", () => {
    const mark = svg(
      `<path d="M0 0H600V600H0Z" fill="black" /><circle cx="300" cy="300" r="70" fill="#22d3ee" />`,
    )

    const inspection = inspectTenantLogoSvg(mark)
    expect(inspection.hasEmbeddedBackground).toBe(true)
    expect(inspection.backgroundIsDark).toBe(true)
  })

  it("falls back safely for malformed SVG", () => {
    expect(inspectTenantLogoSvg("<svg><rect")).toEqual({
      hasEmbeddedBackground: false,
      backgroundColor: null,
      backgroundIsDark: false,
      backgroundIsLight: false,
    })
  })

  it("ignores transparent fills even when the rect covers the viewBox", () => {
    const mark = svg(
      `<rect width="600" height="600" fill="none" /><circle cx="300" cy="300" r="80" fill="#22d3ee" />`,
    )

    expect(inspectTenantLogoSvg(mark).hasEmbeddedBackground).toBe(false)
  })
})
