import { useCallback, useRef, useState, useSyncExternalStore } from "react"

const query = "(max-width: 1023px)"

function getSnapshot() {
  return window.matchMedia?.(query).matches ?? false
}

export function usePeopleMobileActions<T>() {
  const [actionItem, setActionItem] = useState<T | null>(null)
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null)
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia?.(query)
    const onMediaChange = () => {
      if (!media?.matches) setActionItem(null)
      onChange()
    }
    media?.addEventListener("change", onMediaChange)
    return () => media?.removeEventListener("change", onMediaChange)
  }, [])
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, () => false)

  return { isMobile, actionItem, setActionItem, actionTriggerRef }
}
