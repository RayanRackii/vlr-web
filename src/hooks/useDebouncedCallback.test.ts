import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDebouncedCallback } from "@/hooks/useDebouncedCallback"

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("flushes a pending call before the delay elapses", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 400))

    act(() => {
      result.current("draft")
    })
    expect(callback).not.toHaveBeenCalled()

    act(() => {
      result.current.flush()
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("draft")
  })

  it("returns the callback result from flush", async () => {
    const callback = vi.fn((_value: string) => Promise.resolve("saved"))
    const { result } = renderHook(() => useDebouncedCallback(callback, 400))

    act(() => {
      result.current("draft")
    })

    let flushed: unknown
    act(() => {
      flushed = result.current.flush()
    })

    await expect(flushed).resolves.toBe("saved")
  })
})
