import { describe, expect, it } from "vitest"

import {
  appendReturnToParam,
  isSafeReturnToPath,
  readReturnToParam,
} from "./tenantPortalReturnTo"

describe("isSafeReturnToPath", () => {
  it.each([
    "/t/acme/agenda?reservation=abc",
    "/t/acme/agenda",
    "/app",
  ])("accepts %s", (value) => {
    expect(isSafeReturnToPath(value)).toBe(true)
  })

  it.each([
    "",
    "//evil.com",
    "https://evil.com",
    "http://evil.com/t/acme",
    "javascript:alert(1)",
    "\\\\evil.com",
    "agenda?reservation=abc",
    "/agenda\r\nSet-Cookie: x",
  ])("rejects %s", (value) => {
    expect(isSafeReturnToPath(value)).toBe(false)
  })
})

describe("readReturnToParam", () => {
  it("returns a safe value", () => {
    const params = new URLSearchParams({ returnTo: "/t/acme/agenda?reservation=abc" })
    expect(readReturnToParam(params)).toBe("/t/acme/agenda?reservation=abc")
  })

  it("returns null when absent", () => {
    expect(readReturnToParam(new URLSearchParams())).toBeNull()
  })

  it("returns null when unsafe", () => {
    const params = new URLSearchParams({ returnTo: "//evil.com" })
    expect(readReturnToParam(params)).toBeNull()
  })
})

describe("appendReturnToParam", () => {
  it("appends a safe returnTo", () => {
    expect(appendReturnToParam("/t/acme", "/t/acme/agenda?reservation=abc")).toBe(
      "/t/acme?returnTo=%2Ft%2Facme%2Fagenda%3Freservation%3Dabc",
    )
  })

  it("drops an unsafe returnTo", () => {
    expect(appendReturnToParam("/t/acme", "//evil.com")).toBe("/t/acme")
  })
})
