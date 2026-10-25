import { describe, expect, it } from "vitest"

import { normalizeTime24 } from "@/lib/time24"

describe("normalizeTime24", () => {
  it.each([
    ["8", "08:00"],
    ["830", "08:30"],
    ["0830", "08:30"],
    ["8:30", "08:30"],
    ["20:00", "20:00"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeTime24(raw)).toBe(expected)
  })

  it.each(["", "24:00", "8:75", "abc", "12345", "8::", "8:30:", "a:30"])("rejects %s", (raw) => {
    expect(normalizeTime24(raw)).toBeNull()
  })
})
