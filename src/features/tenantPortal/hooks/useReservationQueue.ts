import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  fetchReservationQueue,
  getReservationQueueErrorCode,
  joinReservationQueue,
  leaveReservationQueue,
  type ReservationQueueStatus,
} from "@/features/tenantPortal/services/tenantPortalService"

const POLL_INTERVAL_MS = 4000
const COUNTDOWN_TICK_MS = 1000
const SAO_PAULO_TZ = "America/Sao_Paulo"

export type ReservationQueueView =
  | { kind: "hidden" }
  | { kind: "closed"; waitingRoomTime: string; opensTime: string }
  | { kind: "join" }
  | { kind: "waiting"; position: number; aheadCount: number }
  | { kind: "active"; countdown: string }
  | { kind: "expired" }

function toastQueueFailure(
  error: unknown,
  fallback: string,
  translate: (key: string) => string,
) {
  const code = getReservationQueueErrorCode(error)
  toast.error(
    code
      ? translate(`tenantPortal.agenda.queue.errors.${code}`)
      : error instanceof Error
        ? error.message
        : fallback,
  )
}

function formatQueueClockTime(iso: string | null | undefined, locale: string): string {
  if (!iso) {
    return ""
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SAO_PAULO_TZ,
  })
}

function remainingTurnMs(
  turnExpiresAt: string,
  serverNow: string,
  receivedAtMs: number,
  nowMs: number,
): number {
  const expires = Date.parse(turnExpiresAt)
  const server = Date.parse(serverNow)
  if (Number.isNaN(expires) || Number.isNaN(server)) {
    return 0
  }
  return expires - server - (nowMs - receivedAtMs)
}

function formatTurnCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function useReservationQueue(options: {
  rentalAssetId: string | null
  enabled: boolean
}): {
  view: ReservationQueueView
  canReserve: boolean
  hideReserveUi: boolean
  joining: boolean
  leaving: boolean
  join: () => Promise<void>
  leave: () => Promise<void>
  refresh: () => Promise<void>
  applyBookingError: (error: unknown) => boolean
} {
  const { rentalAssetId, enabled } = options
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<ReservationQueueStatus | null>(null)
  const [receivedAtMs, setReceivedAtMs] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const loadErrorToasted = useRef(false)
  const expireRefreshed = useRef(false)

  const applyStatus = useCallback((next: ReservationQueueStatus) => {
    setStatus(next)
    setReceivedAtMs(Date.now())
  }, [])

  const refresh = useCallback(async () => {
    if (!enabled || !rentalAssetId) {
      setStatus(null)
      return
    }
    try {
      const next = await fetchReservationQueue(rentalAssetId)
      applyStatus(next)
      loadErrorToasted.current = false
    } catch (error) {
      if (!loadErrorToasted.current) {
        loadErrorToasted.current = true
        toastQueueFailure(error, t("apiErrors.loadQueue"), t)
      }
    }
  }, [applyStatus, enabled, rentalAssetId, t])

  useEffect(() => {
    setStatus(null)
    loadErrorToasted.current = false
    expireRefreshed.current = false
  }, [rentalAssetId, enabled])

  useEffect(() => {
    if (!enabled || !rentalAssetId) {
      return
    }

    const assetId = rentalAssetId
    let cancelled = false
    let intervalId: number | null = null

    async function load() {
      try {
        const next = await fetchReservationQueue(assetId)
        if (!cancelled) {
          applyStatus(next)
          loadErrorToasted.current = false
        }
      } catch (error) {
        if (!cancelled && !loadErrorToasted.current) {
          loadErrorToasted.current = true
          toastQueueFailure(error, t("apiErrors.loadQueue"), t)
        }
      }
    }

    function startPolling() {
      if (intervalId != null) {
        return
      }
      intervalId = window.setInterval(() => {
        void load()
      }, POLL_INTERVAL_MS)
    }

    function stopPolling() {
      if (intervalId != null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    void load()
    if (!document.hidden) {
      startPolling()
    }

    function onVisibility() {
      if (document.hidden) {
        stopPolling()
        return
      }
      void load()
      startPolling()
    }

    function onFocus() {
      if (document.hidden) {
        return
      }
      void load()
      startPolling()
    }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)

    return () => {
      cancelled = true
      stopPolling()
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
    }
  }, [applyStatus, enabled, rentalAssetId, t])

  const ticket = status?.myTicket ?? null
  const remainingMs =
    ticket?.status === "Active" && ticket.turnExpiresAt && status
      ? remainingTurnMs(ticket.turnExpiresAt, status.serverNow, receivedAtMs, nowMs)
      : 0

  useEffect(() => {
    if (ticket?.status !== "Active") {
      return
    }
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, COUNTDOWN_TICK_MS)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [ticket?.status, ticket?.id])

  useEffect(() => {
    if (ticket?.status !== "Active") {
      expireRefreshed.current = false
      return
    }
    if (remainingMs <= 0 && !expireRefreshed.current) {
      expireRefreshed.current = true
      void refresh()
    }
  }, [remainingMs, refresh, ticket?.status])

  const view = useMemo((): ReservationQueueView => {
    if (!enabled) {
      return { kind: "hidden" }
    }
    if (!status || status.queueEnabled !== true) {
      return { kind: "hidden" }
    }

    const currentTicket = status.myTicket
    if (currentTicket?.status === "Active") {
      return {
        kind: "active",
        countdown: formatTurnCountdown(remainingMs),
      }
    }
    if (currentTicket?.status === "Waiting") {
      return {
        kind: "waiting",
        position: currentTicket.position,
        aheadCount: status.aheadCount,
      }
    }
    if (currentTicket?.status === "Expired") {
      return { kind: "expired" }
    }
    if (status.phase === "Closed") {
      return {
        kind: "closed",
        waitingRoomTime: formatQueueClockTime(
          status.waitingRoomOpensAt,
          i18n.language,
        ),
        opensTime: formatQueueClockTime(status.opensAt, i18n.language),
      }
    }
    return { kind: "join" }
  }, [enabled, i18n.language, remainingMs, status])

  const queueGating =
    enabled && (status == null || status.queueEnabled === true)
  const canReserve = !queueGating || view.kind === "active"
  const hideReserveUi = view.kind === "expired"

  const join = useCallback(async () => {
    if (!rentalAssetId) {
      return
    }
    setJoining(true)
    try {
      const next = await joinReservationQueue(rentalAssetId)
      applyStatus(next)
    } catch (error) {
      toastQueueFailure(error, t("apiErrors.joinQueue"), t)
      void refresh()
    } finally {
      setJoining(false)
    }
  }, [applyStatus, refresh, rentalAssetId, t])

  const leave = useCallback(async () => {
    if (!rentalAssetId) {
      return
    }
    setLeaving(true)
    try {
      const next = await leaveReservationQueue(rentalAssetId)
      applyStatus(next)
    } catch (error) {
      toastQueueFailure(error, t("apiErrors.leaveQueue"), t)
      void refresh()
    } finally {
      setLeaving(false)
    }
  }, [applyStatus, refresh, rentalAssetId, t])

  const applyBookingError = useCallback(
    (error: unknown): boolean => {
      const code = getReservationQueueErrorCode(error)
      if (!code) {
        return false
      }
      void refresh()
      return true
    },
    [refresh],
  )

  return {
    view,
    canReserve,
    hideReserveUi,
    joining,
    leaving,
    join,
    leave,
    refresh,
    applyBookingError,
  }
}
