import { describe, expect, it } from "vitest"

import {
  isSafeStaffNextPath,
  safeStaffNextPath,
  staffLoginPath,
} from "@/lib/safeStaffNextPath"

describe("safeStaffNextPath", () => {
  it("accepts in-app staff paths", () => {
    expect(safeStaffNextPath("/dashboard")).toBe("/dashboard")
    expect(safeStaffNextPath("/os/nova")).toBe("/os/nova")
    expect(safeStaffNextPath("/configuracoes/reservas?date=2026-09-12")).toBe(
      "/configuracoes/reservas?date=2026-09-12",
    )
  })

  it("rejects open redirects and protocol-relative URLs", () => {
    expect(isSafeStaffNextPath("https://evil.example")).toBe(false)
    expect(isSafeStaffNextPath("//evil.example")).toBe(false)
    expect(isSafeStaffNextPath("/\\evil.example")).toBe(false)
    expect(isSafeStaffNextPath("/login?next=https://evil.example")).toBe(false)
  })

  it("rejects B2C portal and auth loops", () => {
    expect(isSafeStaffNextPath("/")).toBe(false)
    expect(isSafeStaffNextPath("/login")).toBe(false)
    expect(isSafeStaffNextPath("/t/ficc/app")).toBe(false)
    expect(isSafeStaffNextPath("/invite")).toBe(false)
  })

  it("builds a login URL with an encoded next param", () => {
    expect(staffLoginPath("/os")).toBe("/login?next=%2Fos")
  })
})
