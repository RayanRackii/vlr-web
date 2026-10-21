import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ReservationDateStrip } from "@/features/tenantPortal/components/ReservationDateStrip"
import {
  ResourceTimeTable,
  type ReservationGridSelection,
} from "@/features/tenantPortal/components/ResourceTimeTable"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { useBookingIdleTimeout } from "@/features/tenantPortal/hooks/useBookingIdleTimeout"
import { useRefreshOnForeground } from "@/features/tenantPortal/hooks/useRefreshOnForeground"
import { readAgendaDateParam } from "@/features/tenantPortal/lib/agendaSelectionQuery"
import { newBookingHandoffSearchParams } from "@/features/tenantPortal/lib/newBookingHandoff"
import {
  fetchPortalDailyAvailability,
  type PortalDailyAvailability,
} from "@/features/tenantPortal/services/tenantPortalService"
import { brazilTodayIsoDate, isBrazilSlotStartInPast } from "@/lib/brazilTimeZone"

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

function selectionIsAvailable(
  availability: PortalDailyAvailability,
  selection: ReservationGridSelection,
): boolean {
  const resource = availability.resources.find(
    (candidate) => candidate.rentalAssetId === selection.rentalAssetId,
  )
  return resource?.windows.some(
    (window) =>
      window.startTime === selection.startTime &&
      window.endTime === selection.endTime &&
      window.state === "Available",
  ) ?? false
}

export function TenantPortalNewBookingPage() {
  const { t, i18n } = useTranslation()
  const { subdomain } = useOutletContext<CustomerAppOutletContext>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const initialDate = readAgendaDateParam(searchParams.get("date"), brazilTodayIsoDate())
  const [startDate, setStartDate] = useState(initialDate)
  const [date, setDate] = useState(initialDate)
  const [availability, setAvailability] = useState<PortalDailyAvailability | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [selection, setSelection] = useState<ReservationGridSelection | null>(null)
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null)
  const requestId = useRef(0)
  const selectionRef = useRef(selection)
  useEffect(() => {
    selectionRef.current = selection
  }, [selection])
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startDate, index)), [startDate])
  const requestedQuantity = selection?.quantity ?? 1

  const expireSelection = useCallback(() => {
    if (selectionRef.current === null) return
    selectionRef.current = null
    setSelection(null)
    setSelectionNotice(t("tenantPortal.agenda.selectionExpired"))
  }, [t])

  useEffect(() => {
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest
    let cancelled = false
    // Changing the query scope must synchronously prevent interaction with
    // stale availability while the replacement request is in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(false)
    void fetchPortalDailyAvailability(subdomain, date, requestedQuantity)
      .then((next) => {
        if (cancelled || requestId.current !== currentRequest) return
        setAvailability(next)
        const currentSelection = selectionRef.current
        if (currentSelection && !selectionIsAvailable(next, currentSelection)) {
          selectionRef.current = null
          setSelection(null)
          setSelectionNotice(t("tenantPortal.agenda.selectionUnavailable"))
        }
      })
      .catch(() => {
        if (!cancelled && requestId.current === currentRequest) setError(true)
      })
      .finally(() => {
        if (!cancelled && requestId.current === currentRequest) setLoading(false)
      })
    return () => { cancelled = true }
  }, [date, reload, requestedQuantity, subdomain, t])

  useEffect(() => {
    if (selection === null) return
    const checkStart = () => {
      if (isBrazilSlotStartInPast(date, selection.startTime)) expireSelection()
    }
    checkStart()
    const timer = window.setInterval(checkStart, 30_000)
    return () => window.clearInterval(timer)
  }, [date, expireSelection, selection])

  const checkIdleTimeout = useBookingIdleTimeout({
    selectionKey: selection
      ? JSON.stringify([subdomain, date, selection.rentalAssetId, selection.startTime, selection.endTime, selection.quantity])
      : null,
    paused: false,
    onExpire: expireSelection,
  })
  const refreshAvailability = useCallback(() => {
    if (checkIdleTimeout()) return
    setReload((value) => value + 1)
  }, [checkIdleTimeout])
  useRefreshOnForeground(refreshAvailability, selection !== null)

  const chooseDate = (next: string) => {
    const safeDate = readAgendaDateParam(next, brazilTodayIsoDate())
    selectionRef.current = null
    setSelection(null)
    setSelectionNotice(null)
    setDate(safeDate)
    const params = new URLSearchParams(searchParams)
    if (safeDate === brazilTodayIsoDate()) params.delete("date")
    else params.set("date", safeDate)
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : "" }, { replace: true })
  }
  const changeQuantity = (quantity: number) => {
    if (selectionRef.current === null) return
    const next = { ...selectionRef.current, quantity }
    selectionRef.current = next
    setSelectionNotice(null)
    setSelection(next)
  }
  const handoff = () => {
    if (!selection) return
    const params = newBookingHandoffSearchParams(searchParams, date, selection)
    navigate({ pathname: location.pathname, search: `?${params}` })
  }
  const viewQueue = (rentalAssetId: string) => {
    const params = new URLSearchParams(searchParams)
    params.set("legacyBooking", "1")
    params.set("date", date)
    params.set("rentalAssetId", rentalAssetId)
    params.delete("time")
    params.delete("endTime")
    params.delete("quantity")
    navigate({ pathname: location.pathname, search: `?${params}` })
  }
  return <div className="mx-auto w-full max-w-6xl space-y-6"><div><h2 className="text-lg font-semibold">{t("tenantPortal.agenda.title")}</h2><p className="text-sm text-muted-foreground">{t("tenantPortal.agenda.subtitleSlots")}</p></div><ReservationDateStrip dates={dates} selectedDate={date} locale={i18n.resolvedLanguage ?? i18n.language} onSelect={chooseDate} onPrevious={() => { const next = addDays(startDate, -7); setStartDate(next); chooseDate(next) }} onNext={() => { const next = addDays(startDate, 7); setStartDate(next); chooseDate(next) }} />{selectionNotice ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{selectionNotice}</p> : null}{loading ? <div aria-busy="true" className="h-52 animate-pulse rounded-lg bg-muted" /> : null}{error ? <div role="alert" className="space-y-3 rounded-lg border p-4 text-sm"><p>{t("tenantPortal.agenda.availabilityError")}</p><Button type="button" variant="outline" onClick={() => setReload((value) => value + 1)}>{t("common.retry")}</Button></div> : null}{!loading && !error && availability ? <ResourceTimeTable availability={availability} locale={i18n.resolvedLanguage ?? i18n.language} selection={selection} onSelect={(next) => { selectionRef.current = next; setSelectionNotice(null); setSelection(next) }} onQuantityChange={changeQuantity} onViewQueue={viewQueue} /> : null}{selection ? <Button type="button" onClick={handoff}>{t("tenantPortal.agenda.continue")}</Button> : <p className="text-sm text-muted-foreground" aria-live="polite">{t("tenantPortal.agenda.selectSlot")}</p>}</div>
}
