import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { CivilDateInput } from "@/components/CivilDateInput"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { deliveryErrorText } from "@/features/catalog/lib/deliveryErrorMessage"
import { formatCatalogDate, type NotificationChannel, type NotificationDeliveryStatus } from "@/features/catalog/schemas/catalogSchemas"
import { DELIVERY_EVENT_KEYS, deliveryEventLabel } from "@/features/notifications/lib/deliveryEventLabel"
import { NOTIFICATION_DELIVERY_PAGE_SIZE, type NotificationDelivery } from "@/features/notifications/schemas/notificationDeliverySchemas"
import { listNotificationDeliveries, resendNotificationDelivery } from "@/features/notifications/services/notificationDeliveryService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { formatLocaleCivilDate } from "@/lib/localeFormat"

const NARROW_QUERY = "(max-width: 760px)"
const STATUSES: NotificationDeliveryStatus[] = ["Queued", "Sending", "Sent", "Delivered", "Failed"]
const CHANNELS: NotificationChannel[] = ["Email", "WhatsApp", "InApp", "Sms"]

function useNarrowFilters(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia?.(NARROW_QUERY)
    media?.addEventListener("change", onChange)
    return () => media?.removeEventListener("change", onChange)
  }, [])
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(NARROW_QUERY).matches ?? false, () => false)
}

function dayBound(value: string, end: boolean): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function toneFor(status: NotificationDeliveryStatus): "ok" | "fail" | "wait" {
  if (status === "Failed") return "fail"
  if (status === "Sent" || status === "Delivered") return "ok"
  return "wait"
}

function ChoiceList({ label, value, options, onChange }: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const narrow = useNarrowFilters()
  const selected = options.find((option) => option.value === value)?.label
  const choices = (
    <div className="space-y-1" role="group" aria-label={label}>
      {options.map((option) => (
        <Button key={option.value || "all"} type="button" variant={value === option.value ? "secondary" : "ghost"} className="min-h-11 w-full justify-start" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </Button>
      ))}
    </div>
  )
  if (narrow) return <fieldset className="min-w-0 space-y-1"><legend className="px-1 text-sm font-medium">{label}</legend>{choices}</fieldset>
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" className="min-h-11" />}>
        {selected && value ? `${label}: ${selected}` : label} +
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">{choices}</PopoverContent>
    </Popover>
  )
}

export function NotificationHistoryPanel() {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const narrow = useNarrowFilters()
  const { can } = usePermissions()
  const canResend = can("core.notifications.resend") || can("catalog.notifications.resend")
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [status, setStatus] = useState<NotificationDeliveryStatus | "">("")
  const [channel, setChannel] = useState<NotificationChannel | "">("")
  const [event, setEvent] = useState("")
  const [fromText, setFromText] = useState("")
  const [toText, setToText] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  const inFlight = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    void listNotificationDeliveries({
      page,
      pageSize: NOTIFICATION_DELIVERY_PAGE_SIZE,
      status: status || undefined,
      channel: channel || undefined,
      event: event || undefined,
      from: dayBound(from, false),
      to: dayBound(to, true),
    }).then((result) => {
      if (cancelled) return
      setDeliveries(result.items)
      setTotalCount(result.totalCount)
      setLoadError(null)
    }).catch((error: unknown) => {
      if (cancelled) return
      setLoadError(error instanceof Error ? error.message : t("apiErrors.loadCatalogNotifications"))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [channel, event, from, page, status, t, to])

  async function resend(id: string) {
    if (inFlight.current.has(id)) return
    inFlight.current.add(id)
    setBusyIds(new Set(inFlight.current))
    try {
      const updated = await resendNotificationDelivery(id)
      setDeliveries((current) => current.map((item) => item.id === id ? updated : item))
      if (updated.status === "Sending") toast.message(t("catalog.notifications.toastResendSending"))
      else if (updated.status === "Queued") toast.success(t("catalog.notifications.toastResent"))
      else if (updated.status === "Sent" || updated.status === "Delivered") toast.success(t("catalog.notifications.toastResentSent"))
      else toast.error(deliveryErrorText(updated.errorMessage, t) || t("catalog.notifications.toastResendFailed"))
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("apiErrors.resendCatalogNotification"))
    } finally {
      inFlight.current.delete(id)
      setBusyIds(new Set(inFlight.current))
    }
  }

  const needle = search.trim().toLocaleLowerCase(i18n.language)
  const visible = deliveries.filter((item) => {
    if (!needle) return true
    const haystack = [item.recipientName, deliveryEventLabel(item.eventKey, t), t(`catalog.channels.${item.channel}`), deliveryErrorText(item.errorMessage, t)]
      .filter(Boolean).join(" ").toLocaleLowerCase(i18n.language)
    return haystack.includes(needle)
  })
  const filtered = Boolean(needle || status || channel || event || from || to)
  const periodLabel = from || to
    ? `${t("notifications.page.period")}: ${from ? formatLocaleCivilDate(from, i18n.language) : "…"} – ${to ? formatLocaleCivilDate(to, i18n.language) : "…"}`
    : t("notifications.page.period")
  function changeBound(which: "from" | "to", value: string) {
    if (which === "from") setFromText(value)
    else setToText(value)
    if (value !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return
    setLoading(true)
    if (which === "from") setFrom(value)
    else setTo(value)
    setPage(1)
  }

  const periodFields = (
    <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1 text-xs text-muted-foreground">
        {t("catalog.notifications.filters.from")}
        <CivilDateInput aria-label={t("catalog.notifications.filters.from")} locale={i18n.language} value={fromText} onChange={(value) => changeBound("from", value)} />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        {t("catalog.notifications.filters.to")}
        <CivilDateInput aria-label={t("catalog.notifications.filters.to")} locale={i18n.language} value={toText} onChange={(value) => changeBound("to", value)} />
      </label>
    </div>
  )

  function clearFilters() {
    setLoading(true)
    setSearch(""); setStatus(""); setChannel(""); setEvent("")
    setFromText(""); setToText(""); setFrom(""); setTo(""); setPage(1)
  }

  return (
    <section className="space-y-5" aria-labelledby="notification-history-title">
      <div>
        <h2 id="notification-history-title" className="text-base font-semibold">{t("notifications.page.historyTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("notifications.page.historySubtitle")}</p>
      </div>
      <div className="notifications-card">
        <div className="notifications-toolbar">
          <label className="notifications-search">
            <Search aria-hidden />
            <Input type="search" aria-label={t("notifications.page.search")} placeholder={t("notifications.page.search")} value={search} onChange={(change) => setSearch(change.target.value)} />
          </label>
          <Button type="button" variant="outline" className="notifications-mobile-filters" aria-expanded={filtersOpen} aria-controls="notification-filters" onClick={() => setFiltersOpen((open) => !open)}>
            {t("notifications.page.filters")} +
          </Button>
          <div id="notification-filters" className="notifications-filters" data-expanded={filtersOpen}>
            <ChoiceList label={t("notifications.page.status")} value={status} onChange={(value) => { setLoading(true); setStatus(value as NotificationDeliveryStatus | ""); setPage(1) }} options={[{ value: "", label: t("notifications.page.all") }, ...STATUSES.map((item) => ({ value: item, label: t(`catalog.deliveryStatus.${item}`) }))]} />
            <ChoiceList label={t("notifications.page.channel")} value={channel} onChange={(value) => { setLoading(true); setChannel(value as NotificationChannel | ""); setPage(1) }} options={[{ value: "", label: t("notifications.page.all") }, ...CHANNELS.map((item) => ({ value: item, label: t(`catalog.channels.${item}`) }))]} />
            <ChoiceList label={t("notifications.page.event")} value={event} onChange={(value) => { setLoading(true); setEvent(value); setPage(1) }} options={[{ value: "", label: t("notifications.page.all") }, ...DELIVERY_EVENT_KEYS.map((item) => ({ value: item, label: deliveryEventLabel(item, t) }))]} />
            {narrow ? <fieldset className="min-w-0 space-y-1"><legend className="px-1 text-sm font-medium">{t("notifications.page.period")}</legend>{periodFields}</fieldset> : (
              <Popover>
                <PopoverTrigger render={<Button type="button" variant="outline" className="min-h-11" />}>{periodLabel} +</PopoverTrigger>
                <PopoverContent align="end" className="w-72">{periodFields}</PopoverContent>
              </Popover>
            )}
          </div>
        </div>
        {loadError ? <p role="alert" className="p-4 text-sm text-destructive">{loadError}</p> : null}
        {loading ? <p role="status" className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p> : null}
        {!loading && !loadError && visible.length === 0 ? (
          <div className="notifications-empty" role="status">
            <h3 className="text-base font-semibold">{t(filtered ? "notifications.page.noResultsTitle" : "notifications.page.emptyHistoryTitle")}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t(filtered ? "notifications.page.noResults" : "notifications.page.emptyHistory")}</p>
            {filtered ? <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={clearFilters}>{t("notifications.page.clear")}</Button> : null}
          </div>
        ) : null}
        {!loading && !loadError ? visible.map((delivery) => {
          const eventLabel = deliveryEventLabel(delivery.eventKey, t)
          const who = delivery.recipientName?.trim() || t(`catalog.recipient.${delivery.recipientKind}`)
          const error = deliveryErrorText(delivery.errorMessage, t)
          const showResend = delivery.status === "Failed" && canResend && delivery.canResend !== false
          return (
            <article key={delivery.id} className="notifications-row">
              <div className="notifications-row-main">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{eventLabel}</p>
                  <span className="notifications-badge" data-tone={toneFor(delivery.status)}>{t(`catalog.deliveryStatus.${delivery.status}`)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{[who, t(`catalog.channels.${delivery.channel}`), error].filter(Boolean).join(" · ")}</p>
              </div>
              <time className="notifications-when" dateTime={delivery.createdAt}>{formatCatalogDate(delivery.createdAt, i18n.language, timeZoneId)}</time>
              <div className="notifications-actions">
                {showResend ? (
                  <Button type="button" variant="outline" size="sm" disabled={busyIds.has(delivery.id)} onClick={() => { void resend(delivery.id) }}>
                    {t("catalog.notifications.resend")}
                  </Button>
                ) : null}
              </div>
            </article>
          )
        }) : null}
        {!loading && !loadError ? (
          <div className="notifications-foot flex flex-wrap items-center justify-between gap-3">
            <p>{t("notifications.page.showing", { shown: visible.length, total: needle ? deliveries.length : totalCount })}</p>
            {totalCount > NOTIFICATION_DELIVERY_PAGE_SIZE ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="min-h-11" disabled={page <= 1} onClick={() => { setLoading(true); setPage((current) => current - 1) }}>{t("notifications.page.previous")}</Button>
                <Button type="button" variant="outline" className="min-h-11" disabled={page * NOTIFICATION_DELIVERY_PAGE_SIZE >= totalCount} onClick={() => { setLoading(true); setPage((current) => current + 1) }}>{t("notifications.page.next")}</Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
