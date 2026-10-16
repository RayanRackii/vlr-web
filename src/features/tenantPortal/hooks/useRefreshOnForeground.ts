import { useEffect, useLayoutEffect, useRef } from "react"

/** Minimum gap between focus and visibility refetches. This is not a poll. */
export const FOREGROUND_REFRESH_MIN_MS = 2_000

/**
 * Refetch when the tab becomes visible or the window gains focus.
 * Focus and visibility often fire together; the gap keeps that to one read.
 */
export function useRefreshOnForeground(
  onRefresh: () => void,
  enabled: boolean,
): void {
  const onRefreshRef = useRef(onRefresh)

  useLayoutEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let lastAt = Date.now()

    function refresh() {
      if (document.visibilityState === "hidden") {
        return
      }

      const now = Date.now()
      if (now - lastAt < FOREGROUND_REFRESH_MIN_MS) {
        return
      }

      lastAt = now
      onRefreshRef.current()
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        refresh()
      }
    }

    function onFocus() {
      refresh()
    }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
    }
  }, [enabled])
}
