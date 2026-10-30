import { describe, expect, it } from "vitest"

import { isWithinCancelCutoff } from "./cancelCutoffWarning"

const NOW = new Date("2026-09-08T10:00:00.000Z") // 07:00 in America/Sao_Paulo

describe("isWithinCancelCutoff", () => {
  it("warns when the slot starts inside a 24h cutoff", () => {
    expect(
      isWithinCancelCutoff(24, "2026-09-08", "20:00", "America/Sao_Paulo", NOW),
    ).toBe(true)
  })

  it("does not warn once the slot is outside the cutoff window", () => {
    expect(
      isWithinCancelCutoff(24, "2026-09-10", "08:00", "America/Sao_Paulo", NOW),
    ).toBe(false)
  })

  it("does not warn for a slot that has already started", () => {
    expect(
      isWithinCancelCutoff(24, "2026-09-08", "06:00", "America/Sao_Paulo", NOW),
    ).toBe(false)
  })

  it("does not warn when the resource has no cutoff", () => {
    expect(
      isWithinCancelCutoff(null, "2026-09-08", "08:00", "America/Sao_Paulo", NOW),
    ).toBe(false)
  })

  it("does not warn when the cutoff is zero", () => {
    expect(
      isWithinCancelCutoff(0, "2026-09-08", "08:00", "America/Sao_Paulo", NOW),
    ).toBe(false)
  })
})
