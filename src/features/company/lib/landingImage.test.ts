import { describe, expect, it } from "vitest"

import { LANDING_IMAGE_MAX_BYTES, checkLandingImage } from "@/features/company/lib/landingImage"
import { formToWriteBody } from "@/features/company/schemas/portalAppearanceSchemas"

describe("checkLandingImage", () => {
  it("accepts jpg, png and webp up to 3 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(checkLandingImage({ type, size: LANDING_IMAGE_MAX_BYTES })).toBeNull()
    }
  })

  it("rejects other types and oversized files", () => {
    expect(checkLandingImage({ type: "image/gif", size: 10 })).toBe("type")
    expect(checkLandingImage({ type: "application/pdf", size: 10 })).toBe("type")
    expect(checkLandingImage({ type: "image/png", size: LANDING_IMAGE_MAX_BYTES + 1 })).toBe("size")
  })
})

describe("formToWriteBody", () => {
  it("trims and sends blank as null, always with all three fields", () => {
    expect(formToWriteBody({ landingKicker: "  Clube  ", landingHeadline: "   ", landingSubtitle: "" })).toEqual({
      landingKicker: "Clube",
      landingHeadline: null,
      landingSubtitle: null,
    })
  })
})
