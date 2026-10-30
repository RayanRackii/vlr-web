import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useNotificationSummary } from "@/features/notifications-inbox/hooks/useNotificationSummary"
import { getNotificationSummary } from "@/features/notifications-inbox/services/notificationInboxService"

vi.mock(
  "@/features/notifications-inbox/services/notificationInboxService",
  () => ({
    getNotificationSummary: vi.fn(),
  }),
)

const mockGet = vi.mocked(getNotificationSummary)

function summary(unreadTotal: number) {
  return { unreadTotal, groups: [] }
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  })
}

describe("useNotificationSummary", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGet.mockReset()
    mockGet.mockResolvedValue(summary(1))
    setVisibility("visible")
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("never polls (or fetches) when disabled", async () => {
    renderHook(() => useNotificationSummary(false))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000)
    })
    expect(mockGet).not.toHaveBeenCalled()
  })

  it("fetches once on mount and polls every 30s while visible", async () => {
    renderHook(() => useNotificationSummary(true))
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGet).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockGet).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockGet).toHaveBeenCalledTimes(3)
  })

  it("pauses polling while the document is hidden and resumes on visible", async () => {
    renderHook(() => useNotificationSummary(true))
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGet).toHaveBeenCalledTimes(1)

    // Go hidden: the interval is cleared, so advancing time does nothing.
    act(() => {
      setVisibility("hidden")
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(mockGet).toHaveBeenCalledTimes(1)

    // Back to visible: refetch immediately and resume the interval.
    act(() => {
      setVisibility("visible")
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGet).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockGet).toHaveBeenCalledTimes(3)
  })

  it("keeps the last good value when a fetch fails (no throw)", async () => {
    const { result } = renderHook(() => useNotificationSummary(true))
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.summary).toEqual(summary(1))

    mockGet.mockRejectedValueOnce(new Error("network"))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(result.current.summary).toEqual(summary(1))
  })
})
