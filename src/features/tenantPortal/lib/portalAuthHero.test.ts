import { describe, expect, it } from "vitest"

import { contrastRatio, parseCssHex } from "@/lib/colorUtils"
import { heroAccentColor, heroSolidBackground, resolveHeroCopy } from "./portalAuthHero"

describe("portalAuthHero", () => {
  it("darkens the primary colour and falls back to neutral dark", () => {
    const dark = parseCssHex(heroSolidBackground("#D4FF00"))!
    expect(dark.g).toBeLessThan(100)
    expect(heroSolidBackground(null)).toBe("#0f172a")
    expect(heroSolidBackground("nope")).toBe("#0f172a")
  })

  it("keeps the kicker readable on the dark hero", () => {
    for (const color of ["#D4FF00", "#0b1f3a", null]) {
      expect(contrastRatio(parseCssHex(heroAccentColor(color))!, { r: 11, g: 18, b: 32 })).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("applies defaults for null texts", () => {
    expect(resolveHeroCopy({ displayName: "Acme" }, "generic")).toEqual({
      kicker: null,
      headline: "Acme",
      subtitle: "generic",
    })
    expect(resolveHeroCopy({ displayName: "Acme", welcomeTagline: "Tag" }, "generic").subtitle).toBe("Tag")
    expect(
      resolveHeroCopy(
        { displayName: "Acme", landingKicker: " K ", landingHeadline: "H", landingSubtitle: "S", welcomeTagline: "Tag" },
        "generic",
      ),
    ).toEqual({ kicker: "K", headline: "H", subtitle: "S" })
  })
})
