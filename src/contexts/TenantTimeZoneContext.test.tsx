import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import {
  useTenantTimeZone,
} from "@/contexts/TenantTimeZoneContext"
import { TenantTimeZoneProvider } from "@/contexts/TenantTimeZoneProvider"

describe("TenantTimeZoneContext", () => {
  it("falls back to America/Sao_Paulo without a provider", () => {
    const { result } = renderHook(() => useTenantTimeZone())

    expect(result.current).toBe("America/Sao_Paulo")
  })

  it("exposes the tenant IANA timezone from the provider", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TenantTimeZoneProvider timeZoneId="Asia/Tokyo">
        {children}
      </TenantTimeZoneProvider>
    )
    const { result } = renderHook(() => useTenantTimeZone(), { wrapper })

    expect(result.current).toBe("Asia/Tokyo")
  })

  it("falls back when the API value is not a valid IANA timezone", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TenantTimeZoneProvider timeZoneId="not-a-zone">
        {children}
      </TenantTimeZoneProvider>
    )
    const { result } = renderHook(() => useTenantTimeZone(), { wrapper })

    expect(result.current).toBe("America/Sao_Paulo")
  })
})
