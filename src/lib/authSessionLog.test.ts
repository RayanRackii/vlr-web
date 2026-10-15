import { afterEach, describe, expect, it, vi } from "vitest"

import {
  logAuthSessionEvent,
  readJwtExpiresAt,
  requestPathWithoutQuery,
} from "@/lib/authSessionLog"

function encodeSegment(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

describe("requestPathWithoutQuery", () => {
  it("drops the query and hash", () => {
    expect(
      requestPathWithoutQuery("/api/users/me?access_token=secret&email=a@b.c#x"),
    ).toBe("/api/users/me")
  })

  it("keeps only the pathname of an absolute URL", () => {
    expect(
      requestPathWithoutQuery(
        "https://user:secret@api.example/api/customers/me?token=secret",
      ),
    ).toBe("/api/customers/me")
  })
})

describe("readJwtExpiresAt", () => {
  it("returns exp and ignores other claims", () => {
    const token = [
      encodeSegment({ alg: "none" }),
      encodeSegment({
        exp: 1_800_000_000,
        sub: "customer-secret-id",
        email: "ada@club.test",
        phone: "+5511999999999",
      }),
      "sig",
    ].join(".")

    expect(readJwtExpiresAt(`Bearer ${token}`)).toBe(1_800_000_000)
  })
})

describe("logAuthSessionEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("writes one allowlisted line and omits secrets", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-15T00:00:00Z"))
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const expiresAt = Math.floor(Date.now() / 1000) + 90

    logAuthSessionEvent({
      event: "API_401",
      surface: "b2c",
      hadSession: true,
      expiresAt,
      error: {
        name: "AuthApiError",
        status: 400,
        code: "refresh_token_not_found",
        message: "leak-token ada@club.test +5511999999999 customer-secret-id",
      },
      httpStatus: 401,
      requestPath: "/api/customers/me?token=leak-token&email=ada@club.test",
    })

    expect(info).toHaveBeenCalledTimes(1)
    const raw = String(info.mock.calls[0]?.[0])
    const line = JSON.parse(raw) as Record<string, unknown>
    expect(line).toEqual({
      event: "API_401",
      surface: "b2c",
      hadSession: true,
      expiresInSec: 90,
      errorName: "AuthApiError",
      errorStatus: 400,
      errorCode: "refresh_token_not_found",
      requestPath: "/api/customers/me",
    })
    expect(raw).not.toContain("leak-token")
    expect(raw).not.toContain("ada@club.test")
    expect(raw).not.toContain("+5511999999999")
    expect(raw).not.toContain("customer-secret-id")
    expect(raw).not.toContain("Authorization")
  })
})
