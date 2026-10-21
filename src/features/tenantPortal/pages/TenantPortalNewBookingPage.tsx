import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ReservationDateStrip } from "@/features/tenantPortal/components/ReservationDateStrip"
import { ResourceTimeTable } from "@/features/tenantPortal/components/ResourceTimeTable"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { brazilTodayIsoDate } from "@/lib/brazilTimeZone"
import { fetchPortalDailyAvailability, type PortalDailyAvailability } from "@/features/tenantPortal/services/tenantPortalService"

function addDays(date: string, days: number): string { const result = new Date(`${date}T00:00:00Z`); result.setUTCDate(result.getUTCDate() + days); return result.toISOString().slice(0, 10) }

export function TenantPortalNewBookingPage() {
  const { t, i18n } = useTranslation()
  const { subdomain } = useOutletContext<CustomerAppOutletContext>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [startDate, setStartDate] = useState(() => searchParams.get("date") ?? brazilTodayIsoDate())
  const [date, setDate] = useState(() => searchParams.get("date") ?? brazilTodayIsoDate())
  const [availability, setAvailability] = useState<PortalDailyAvailability | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [selection, setSelection] = useState<{ rentalAssetId: string; startTime: string; endTime: string } | null>(null)
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startDate, index)), [startDate])

  // A date/retry change must synchronously retire the old interactive selection.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { let cancelled = false; setLoading(true); setError(false); setSelection(null); void fetchPortalDailyAvailability(subdomain, date).then((next) => { if (!cancelled) setAvailability(next) }).catch(() => { if (!cancelled) setError(true) }).finally(() => { if (!cancelled) setLoading(false) }); return () => { cancelled = true } }, [date, reload, subdomain])
  const chooseDate = (next: string) => { setDate(next); const params = new URLSearchParams(searchParams); params.set("date", next); navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true }) }
  const handoff = () => { if (!selection) return; const params = new URLSearchParams(searchParams); params.set("legacyBooking", "1"); params.set("date", date); params.set("time", selection.startTime.slice(0, 5)); params.set("rentalAssetId", selection.rentalAssetId); params.set("endTime", selection.endTime.slice(0, 5)); params.set("quantity", "1"); navigate({ pathname: location.pathname, search: `?${params.toString()}` }) }
  return <div className="mx-auto w-full max-w-6xl space-y-6"><div><h2 className="text-lg font-semibold">{t("tenantPortal.agenda.title")}</h2><p className="text-sm text-muted-foreground">{t("tenantPortal.agenda.subtitleSlots")}</p></div><ReservationDateStrip dates={dates} selectedDate={date} locale={i18n.resolvedLanguage ?? i18n.language} onSelect={chooseDate} onPrevious={() => { const next = addDays(startDate, -7); setStartDate(next); chooseDate(next) }} onNext={() => { const next = addDays(startDate, 7); setStartDate(next); chooseDate(next) }} />{loading ? <div aria-busy="true" className="h-52 animate-pulse rounded-lg bg-muted" /> : null}{error ? <div role="alert" className="space-y-3 rounded-lg border p-4 text-sm"><p>{t("tenantPortal.agenda.availabilityError")}</p><Button type="button" variant="outline" onClick={() => setReload((value) => value + 1)}>{t("common.retry")}</Button></div> : null}{!loading && !error && availability ? <ResourceTimeTable availability={availability} locale={i18n.resolvedLanguage ?? i18n.language} selection={selection} onSelect={setSelection} /> : null}{selection ? <Button type="button" onClick={handoff}>{t("tenantPortal.agenda.continue")}</Button> : <p className="text-sm text-muted-foreground" aria-live="polite">{t("tenantPortal.agenda.selectSlot")}</p>}</div>
}
