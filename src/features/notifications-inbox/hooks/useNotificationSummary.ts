import { useCallback, useEffect, useRef, useState } from "react"

import * as staffNotificationService from "@/features/notifications-inbox/services/notificationInboxService"
import type { NotificationInboxService } from "@/features/notifications-inbox/services/notificationInboxService"
import type { NotificationSummary } from "@/features/notifications-inbox/schemas/notificationInboxSchemas"

const POLL_INTERVAL_MS = 30_000

function documentHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden"
}

export type UseNotificationSummaryResult = {
  summary: NotificationSummary | null
  /** True until the very first successful (or failed) fetch resolves. */
  isInitialLoading: boolean
  /** Imperatively refetch — used after marking groups read. */
  refetch: () => void
}

/**
 * Polls the unread summary every 30s, but only while the document is visible.
 * Refetches immediately on focus / when the tab becomes visible again, keeps the
 * last good value on error (no toasts), and stops all timers/requests on unmount
 * or when `enabled` flips to false (logout / non-staff). Never polls when
 * disabled, so the customer portal and permission-less users stay quiet.
 */
export function useNotificationSummary(
  enabled: boolean,
  service: NotificationInboxService = staffNotificationService,
): UseNotificationSummaryResult {
  const [summary, setSummary] = useState<NotificationSummary | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(enabled)
  const activeRef = useRef(false)
  const hasLoadedRef = useRef(false)
  const inFlightRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    if (!enabled || !activeRef.current || documentHidden()) {
      return
    }
    inFlightRef.current?.abort()
    const controller = new AbortController()
    inFlightRef.current = controller
    try {
      const next = await service.getNotificationSummary(controller.signal)
      if (controller.signal.aborted) {
        return
      }
      setSummary(next)
    } catch {
      // Fail silently: keep the last good value, surface nothing to the user.
    } finally {
      if (!controller.signal.aborted) {
        hasLoadedRef.current = true
        setIsInitialLoading(false)
      }
    }
  }, [enabled, service])

  useEffect(() => {
    activeRef.current = enabled
    if (!enabled) {
      inFlightRef.current?.abort()
      inFlightRef.current = null
      hasLoadedRef.current = false
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale unread state immediately on logout / losing staff access so nothing leaks across identities
      setSummary(null)
      setIsInitialLoading(false)
      return
    }

    setIsInitialLoading(!hasLoadedRef.current)
    void load()

    let interval: ReturnType<typeof setInterval> | null = null
    const startPolling = () => {
      if (interval === null) {
        interval = setInterval(() => void load(), POLL_INTERVAL_MS)
      }
    }
    const stopPolling = () => {
      if (interval !== null) {
        clearInterval(interval)
        interval = null
      }
    }

    const onVisibility = () => {
      if (documentHidden()) {
        stopPolling()
      } else {
        void load()
        startPolling()
      }
    }
    const onFocus = () => {
      if (!documentHidden()) {
        void load()
      }
    }

    if (!documentHidden()) {
      startPolling()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)

    return () => {
      activeRef.current = false
      stopPolling()
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
      inFlightRef.current?.abort()
      inFlightRef.current = null
    }
  }, [enabled, load])

  const refetch = useCallback(() => {
    void load()
  }, [load])

  return { summary, isInitialLoading, refetch }
}
