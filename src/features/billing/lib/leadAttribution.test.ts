import { beforeEach, describe, expect, it } from "vitest"

import {
  buildOnboardingHref,
  pickPassthroughParams,
  readRequestedPackage,
  readRequestedPlan,
  resolvePassthroughParams,
  sanitizeLeadValue,
  toLeadAttribution,
} from "@/features/billing/lib/leadAttribution"

describe("leadAttribution", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("keeps only utm_* and ref from the query", () => {
    expect(
      pickPassthroughParams("?utm_source=google&utm_medium=cpc&ref=ana&package=reservas&x=1&utm_campaign="),
    ).toEqual({ utm_source: "google", utm_medium: "cpc", ref: "ana" })
  })

  it("sanitizes lead values like the API does", () => {
    expect(sanitizeLeadValue("beach-tennis_2026.a")).toBe("beach-tennis_2026.a")
    expect(sanitizeLeadValue("  google ")).toBe("google")
    expect(sanitizeLeadValue("<script>")).toBeNull()
    expect(sanitizeLeadValue("a b")).toBeNull()
    expect(sanitizeLeadValue("x".repeat(101))).toBeNull()
    expect(sanitizeLeadValue("")).toBeNull()
    expect(sanitizeLeadValue(undefined)).toBeNull()
  })

  it("maps utm_source and utm_campaign, with ref as the source fallback", () => {
    expect(toLeadAttribution({ utm_source: "google", utm_campaign: "pmoc", ref: "ana" })).toEqual({
      leadSource: "google",
      leadCampaign: "pmoc",
    })
    expect(toLeadAttribution({ ref: "ana" })).toEqual({ leadSource: "ana", leadCampaign: null })
    expect(toLeadAttribution({ utm_source: "bad value", ref: "ana" }).leadSource).toBe("ana")
    expect(toLeadAttribution({})).toEqual({ leadSource: null, leadCampaign: null })
  })

  it("builds the onboarding link with package, plan and tracking params", () => {
    expect(
      buildOnboardingHref({
        packageKey: "manutencao",
        planKey: "profissional",
        passthrough: { utm_source: "google", ref: "ana" },
      }),
    ).toBe("/onboarding?package=manutencao&plan=profissional&utm_source=google&ref=ana")
    expect(buildOnboardingHref({})).toBe("/onboarding")
  })

  it("reads only known package and plan keys", () => {
    expect(readRequestedPackage("?package=locacao")).toBe("locacao")
    expect(readRequestedPackage("?package=enterprise")).toBeNull()
    expect(readRequestedPlan("?plan=completo")).toBe("completo")
    expect(readRequestedPlan("?plan=gold")).toBeNull()
  })

  it("remembers the params for the tab and uses them when the URL has none", () => {
    expect(resolvePassthroughParams("?utm_source=instagram")).toEqual({ utm_source: "instagram" })
    expect(resolvePassthroughParams("")).toEqual({ utm_source: "instagram" })
    expect(resolvePassthroughParams("?ref=ana")).toEqual({ ref: "ana" })
  })

  it("works when session storage is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage")
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("blocked")
      },
    })
    try {
      expect(resolvePassthroughParams("?utm_source=x")).toEqual({ utm_source: "x" })
      expect(resolvePassthroughParams("")).toEqual({})
    } finally {
      if (original) {
        Object.defineProperty(window, "sessionStorage", original)
      }
    }
  })
})
