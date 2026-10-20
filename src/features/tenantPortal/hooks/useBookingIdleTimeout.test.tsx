import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useBookingIdleTimeout } from "./useBookingIdleTimeout"

describe("useBookingIdleTimeout", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("uses ten minutes by default and expires only once", () => {
    const onExpire = vi.fn()
    renderHook(() => useBookingIdleTimeout({ selectionKey: "space", paused: false, onExpire }))
    act(() => vi.advanceTimersByTime(599_999))
    expect(onExpire).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onExpire).toHaveBeenCalledTimes(1)
    act(() => {
      window.dispatchEvent(new Event("pointerdown"))
      window.dispatchEvent(new Event("focus"))
      vi.advanceTimersByTime(600_000)
    })
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it.each(["pointerdown", "pointermove", "keydown", "touchstart", "touchmove", "scroll"])(
    "resets a configured deadline on %s, including events from children",
    (event) => {
      const onExpire = vi.fn()
      renderHook(() => useBookingIdleTimeout({
        selectionKey: "space", timeoutMinutes: 1, paused: false, onExpire,
      }))
      act(() => vi.advanceTimersByTime(40_000))
      act(() => document.body.dispatchEvent(new Event(event)))
      act(() => vi.advanceTimersByTime(59_999))
      expect(onExpire).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(1))
      expect(onExpire).toHaveBeenCalledTimes(1)
    },
  )

  it("does not start without a selection, and cleans up on deselect and unmount", () => {
    const onExpire = vi.fn()
    const { rerender, unmount } = renderHook(({ key }: { key: string | null }) =>
      useBookingIdleTimeout({ selectionKey: key, paused: false, onExpire }),
    { initialProps: { key: null as string | null } })
    act(() => vi.advanceTimersByTime(600_000))
    expect(onExpire).not.toHaveBeenCalled()
    rerender({ key: "space" })
    act(() => vi.advanceTimersByTime(300_000))
    rerender({ key: null })
    act(() => vi.advanceTimersByTime(600_000))
    expect(onExpire).not.toHaveBeenCalled()
    rerender({ key: "space" })
    unmount()
    act(() => vi.advanceTimersByTime(600_000))
    expect(onExpire).not.toHaveBeenCalled()
  })

  it("suspends expiry during a protected request or turn and resumes with a fresh period", () => {
    const onExpire = vi.fn()
    const { rerender } = renderHook(({ paused }) => useBookingIdleTimeout({
      selectionKey: "space", timeoutMinutes: 1, paused, onExpire,
    }), { initialProps: { paused: false } })
    act(() => vi.advanceTimersByTime(59_000))
    rerender({ paused: true })
    act(() => vi.advanceTimersByTime(120_000))
    expect(onExpire).not.toHaveBeenCalled()
    rerender({ paused: false })
    act(() => vi.advanceTimersByTime(59_999))
    expect(onExpire).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it("keeps the deadline across refresh renders and uses the latest callback", () => {
    const first = vi.fn()
    const latest = vi.fn()
    const { rerender } = renderHook(({ onExpire }) => useBookingIdleTimeout({
      selectionKey: "space", timeoutMinutes: 1, paused: false, onExpire,
    }), { initialProps: { onExpire: first } })
    act(() => vi.advanceTimersByTime(40_000))
    rerender({ onExpire: latest })
    act(() => vi.advanceTimersByTime(20_000))
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
  })

  it("starts a new deadline when the space or configuration changes", () => {
    const onExpire = vi.fn()
    const { rerender } = renderHook(({ key, minutes }) => useBookingIdleTimeout({
      selectionKey: key, timeoutMinutes: minutes, paused: false, onExpire,
    }), { initialProps: { key: "space-a", minutes: 1 } })
    act(() => vi.advanceTimersByTime(50_000))
    rerender({ key: "space-b", minutes: 2 })
    act(() => vi.advanceTimersByTime(119_999))
    expect(onExpire).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it.each([null, "next-slot", "space"])(
    "lets refresh check a throttled deadline before rendering selection %s",
    (nextKey) => {
      const onExpire = vi.fn()
      const { result, rerender } = renderHook(({ key }: { key: string | null }) =>
        useBookingIdleTimeout({ selectionKey: key, paused: false, onExpire }),
      { initialProps: { key: "space" as string | null } })

      // Move the clock without executing the background timer.
      vi.setSystemTime(Date.now() + 660_000)
      act(() => expect(result.current()).toBe(true))
      rerender({ key: nextKey })
      expect(onExpire).toHaveBeenCalledTimes(1)
    },
  )

  it.each(["focus", "visibilitychange", "pointerdown"])(
    "checks an elapsed background deadline on %s before accepting more activity",
    (event) => {
      const onExpire = vi.fn()
      renderHook(() => useBookingIdleTimeout({
        selectionKey: "space", timeoutMinutes: 1, paused: false, onExpire,
      }))
      vi.setSystemTime(Date.now() + 61_000)
      act(() => {
        (event === "visibilitychange" ? document : window).dispatchEvent(new Event(event))
      })
      expect(onExpire).toHaveBeenCalledTimes(1)
    },
  )
})
