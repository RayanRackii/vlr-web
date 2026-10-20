import { useEffect, useLayoutEffect, useRef } from "react"

export const DEFAULT_BOOKING_IDLE_TIMEOUT_MINUTES = 10

type BookingIdleTimeoutOptions = {
  selectionKey: string | null
  timeoutMinutes?: number | null
  paused: boolean
  onExpire: () => void
}

/** Each selection gets an idle deadline. A protected booking/turn starts a fresh
 * idle period when it finishes; background renders do not extend the deadline. */
export function useBookingIdleTimeout({
  selectionKey,
  timeoutMinutes,
  paused,
  onExpire,
}: BookingIdleTimeoutOptions): void {
  const onExpireRef = useRef(onExpire)
  useLayoutEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  const durationMs =
    (timeoutMinutes ?? DEFAULT_BOOKING_IDLE_TIMEOUT_MINUTES) * 60_000

  useEffect(() => {
    if (selectionKey === null || paused) {
      return
    }

    let deadline = Date.now() + durationMs
    let expired = false
    let timer: ReturnType<typeof setTimeout>

    function checkDeadline() {
      if (expired) return
      const remaining = deadline - Date.now()
      if (remaining > 0) {
        clearTimeout(timer)
        timer = setTimeout(checkDeadline, remaining)
        return
      }
      expired = true
      clearTimeout(timer)
      onExpireRef.current()
    }

    function onActivity() {
      if (expired) return
      // A throttled background timer must still expire on return, before the
      // first interaction can extend an already elapsed deadline.
      if (Date.now() >= deadline) {
        checkDeadline()
        return
      }
      deadline = Date.now() + durationMs
      clearTimeout(timer)
      timer = setTimeout(checkDeadline, durationMs)
    }

    function onVisible() {
      if (document.visibilityState === "visible") checkDeadline()
    }

    const activityEvents = [
      "pointerdown", "pointermove", "keydown", "touchstart", "touchmove", "scroll",
    ] as const
    timer = setTimeout(checkDeadline, durationMs)
    for (const event of activityEvents) {
      window.addEventListener(event, onActivity, { capture: true, passive: true })
    }
    window.addEventListener("focus", checkDeadline)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearTimeout(timer)
      for (const event of activityEvents) {
        window.removeEventListener(event, onActivity, true)
      }
      window.removeEventListener("focus", checkDeadline)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [durationMs, paused, selectionKey])
}
