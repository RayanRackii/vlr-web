import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  FOREGROUND_REFRESH_MIN_MS,
  useRefreshOnForeground,
} from "@/features/tenantPortal/hooks/useRefreshOnForeground"

describe("useRefreshOnForeground", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("refetches once when focus and visibility arrive together", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"))
    const onRefresh = vi.fn()
    renderHook(() => useRefreshOnForeground(onRefresh, true))

    vi.setSystemTime(new Date("2026-10-16T12:00:03.000Z"))
    window.dispatchEvent(new Event("focus"))
    document.dispatchEvent(new Event("visibilitychange"))

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it("ignores a second foreground event inside the gap and does not poll", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"))
    const setIntervalSpy = vi.spyOn(window, "setInterval")
    const onRefresh = vi.fn()
    renderHook(() => useRefreshOnForeground(onRefresh, true))

    vi.setSystemTime(new Date("2026-10-16T12:00:03.000Z"))
    window.dispatchEvent(new Event("focus"))
    vi.setSystemTime(
      new Date(
        Date.parse("2026-10-16T12:00:03.000Z") + FOREGROUND_REFRESH_MIN_MS - 1,
      ),
    )
    window.dispatchEvent(new Event("focus"))
    expect(onRefresh).toHaveBeenCalledTimes(1)

    vi.setSystemTime(
      new Date(Date.parse("2026-10-16T12:00:03.000Z") + FOREGROUND_REFRESH_MIN_MS),
    )
    document.dispatchEvent(new Event("visibilitychange"))
    expect(onRefresh).toHaveBeenCalledTimes(2)
    expect(setIntervalSpy).not.toHaveBeenCalled()
  })

  it("does not refetch while the document is hidden", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"))
    const onRefresh = vi.fn()
    renderHook(() => useRefreshOnForeground(onRefresh, true))
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")

    vi.setSystemTime(new Date("2026-10-16T12:00:05.000Z"))
    window.dispatchEvent(new Event("focus"))
    document.dispatchEvent(new Event("visibilitychange"))

    expect(onRefresh).not.toHaveBeenCalled()
  })
})
