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

  it("carries the tenant into staff login as well as the safe return path", () => {
    expect(staffLoginPath("/os?company=ficc#details")).toBe(
      "/login?next=%2Fos%3Fcompany%3Dficc%23details&company=ficc",
    )
  })

  it.each([
    "https://evil.example/os",
    "//evil.example/os",
    "/\\evil.example/os",
    "/login#details",
    "/t/ficc/app",
  ])("does not put an unsafe destination in the login URL: %s", (next) => {
    expect(staffLoginPath(next)).toBe("/login")
  })
})
