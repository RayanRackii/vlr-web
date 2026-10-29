import { useCallback, useSyncExternalStore } from "react"

/**
 * Below the `lg` breakpoint (1024px) the notification panel becomes a bottom
 * sheet; at/above it anchors to the bell as a popover. Mirrors the breakpoint
 * the people mobile actions sheet uses so behaviour stays consistent.
 */
const MOBILE_QUERY = "(max-width: 1023px)"

function getSnapshot(): boolean {
  return window.matchMedia?.(MOBILE_QUERY).matches ?? false
}

export function useViewportIsMobile(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia?.(MOBILE_QUERY)
    media?.addEventListener("change", onChange)
    return () => media?.removeEventListener("change", onChange)
  }, [])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
