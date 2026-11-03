import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { CalendarDays } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { CatalogHeading } from "@/features/catalog/components/StaffCatalogChrome"
import { AgendaTimeline } from "@/features/catalog/components/agenda/AgendaTimeline"
import {
  buildAgendaDays,
  buildDayColumns,
  civilToday,
  columnsToRange,
  startOfCivilWeek,
  addCivilDays,
  type AgendaView,
} from "@/features/catalog/components/agenda/agendaLayout"
import { STAFF_ORDER_STATUS_TONE } from "@/features/catalog/lib/catalogStatusBadge"
import {
  formatCatalogDate,
  type CatalogAgendaItem,
  type CatalogProduct,
  type CatalogProductResourceRequirement,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  getCatalogProductResourceRequirements,
  listCatalogProductAgenda,
  listCatalogProducts,
} from "@/features/catalog/services/catalogService"

function initialView(): AgendaView {
  return window.matchMedia?.("(max-width: 767px)").matches ? "day" : "week"
}

function formatDurationMinutes(total: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours > 0 && minutes > 0) return t("catalog.agenda.duration.hoursMinutes", { hours, minutes })
  if (hours > 0) return t("catalog.agenda.duration.hours", { hours })
  return t("catalog.agenda.duration.minutes", { minutes })
}

function startInstant(item: CatalogAgendaItem): number {
  const value = item.workStart ?? item.occupiedStart
  return value ? new Date(value).getTime() : Number.POSITIVE_INFINITY
}

export function CatalogProductAgendaPage() {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()

  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [productId, setProductId] = useState<string>("")
  const [view, setView] = useState<AgendaView>(initialView)
  const [anchor, setAnchor] = useState<string>(() => civilToday(timeZoneId))
  const [items, setItems] = useState<CatalogAgendaItem[]>([])
  const [requirement, setRequirement] = useState<CatalogProductResourceRequirement | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listCatalogProducts()
      .then((data) => {
        if (cancelled) return
        setProducts(data)
        setProductId((current) => current || data[0]?.id || "")
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : t("apiErrors.loadCatalogProducts"))
        }
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const columns = useMemo(() => buildDayColumns(anchor, view), [anchor, view])
  const range = useMemo(() => columnsToRange(columns), [columns])

  const agendaKey = `${productId}|${range.from}|${range.to}`
  // Derive loading from whether the loaded data matches the current request, so
  // the effect never calls setState synchronously (react-hooks/set-state-in-effect).
  const loading = productId !== "" && loadedKey !== agendaKey

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    void listCatalogProductAgenda({ ...range, productId })
      .then((data) => {
        if (!cancelled) {
          setItems(data)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : t("apiErrors.loadCatalogAgenda"))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(agendaKey)
      })
    return () => {
      cancelled = true
    }
  }, [productId, range, agendaKey, t])

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    void getCatalogProductResourceRequirements(productId)
      .then((response) => {
        if (!cancelled) setRequirement(response.requirements[0] ?? null)
      })
      .catch(() => {
        if (!cancelled) setRequirement(null)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  const days = useMemo(
    () => buildAgendaDays(items, columns, i18n.language),
    [items, columns, i18n.language],
  )

  const upcoming = useMemo(
    () => [...items].sort((a, b) => startInstant(a) - startInstant(b)).slice(0, 10),
    [items],
  )

  const requirementTotal = requirement
    ? requirement.durationMinutesPerUnit * requirement.resourceQuantity +
      requirement.prepMinutes +
      requirement.cleanupMinutes
    : null

  const weekStart = startOfCivilWeek(anchor)
  const periodLabel =
    view === "week"
      ? t("catalog.agenda.weekRange", {
          from: new Intl.DateTimeFormat(i18n.language, { day: "2-digit", month: "short", timeZone: "UTC" }).format(
            new Date(`${weekStart}T00:00:00Z`),
          ),
          to: new Intl.DateTimeFormat(i18n.language, { day: "2-digit", month: "short", timeZone: "UTC" }).format(
            new Date(`${addCivilDays(weekStart, 6)}T00:00:00Z`),
          ),
        })
      : new Intl.DateTimeFormat(i18n.language, { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" }).format(
          new Date(`${anchor}T00:00:00Z`),
        )

  const step = view === "week" ? 7 : 1

  return (
    <div className="staff-catalog">
      <CatalogHeading
        title={t("catalog.agenda.title")}
        description={t("catalog.agenda.subtitle")}
        actions={
          <label className="staff-catalog-search">
            {t("catalog.agenda.productLabel")}
            <select
              className="touch-target min-h-11 rounded-lg border border-input bg-background px-3"
              aria-label={t("catalog.agenda.productLabel")}
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              {products.length === 0 ? <option value="">{t("catalog.agenda.noProducts")}</option> : null}
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {loadError ? (
        <Alert variant="destructive" className="staff-catalog-error">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] items-start">
        <div className="staff-catalog-card">
          <h2 className="text-sm font-semibold mb-3">{t("catalog.agenda.requirementTitle")}</h2>
          {requirement ? (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("catalog.resourcePlanning.fields.resourceQuantity")}</dt>
                <dd>{t("catalog.agenda.units", { count: requirement.resourceQuantity })}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("catalog.resourcePlanning.fields.durationMinutesPerUnit")}</dt>
                <dd>{formatDurationMinutes(requirement.durationMinutesPerUnit, t)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("catalog.resourcePlanning.fields.prepMinutes")}</dt>
                <dd>{formatDurationMinutes(requirement.prepMinutes, t)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("catalog.resourcePlanning.fields.cleanupMinutes")}</dt>
                <dd>{formatDurationMinutes(requirement.cleanupMinutes, t)}</dd>
              </div>
              {requirementTotal != null ? (
                <div className="flex justify-between gap-3 border-t border-border pt-2 text-muted-foreground">
                  <dt>{t("catalog.agenda.totalBlock")}</dt>
                  <dd className="font-semibold text-foreground">{formatDurationMinutes(requirementTotal, t)}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t("catalog.agenda.noRequirement")}</p>
          )}
        </div>

        <div className="staff-catalog-card" aria-busy={loading}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} aria-hidden="true" />
              <h2 className="text-sm font-semibold">{periodLabel}</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setAnchor((a) => addCivilDays(a, -step))}>
                  {t("catalog.agenda.prev")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(civilToday(timeZoneId))}>
                  {t("catalog.agenda.today")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAnchor((a) => addCivilDays(a, step))}>
                  {t("catalog.agenda.next")}
                </Button>
              </div>
              <div className="flex gap-1" role="group" aria-label={t("catalog.agenda.viewLabel")}>
                <Button
                  type="button"
                  variant={view === "week" ? "default" : "outline"}
                  size="sm"
                  aria-pressed={view === "week"}
                  onClick={() => setView("week")}
                >
                  {t("catalog.agenda.week")}
                </Button>
                <Button
                  type="button"
                  variant={view === "day" ? "default" : "outline"}
                  size="sm"
                  aria-pressed={view === "day"}
                  onClick={() => setView("day")}
                >
                  {t("catalog.agenda.day")}
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("catalog.staff.loading")}
            </p>
          ) : (
            <AgendaTimeline days={days} locale={i18n.language} />
          )}
        </div>
      </div>

      <div className="staff-catalog-card mt-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold">{t("catalog.agenda.upcomingTitle")}</h2>
          <Link to="/catalogo/pedidos" className="text-sm font-semibold text-primary">
            {t("catalog.agenda.viewAll")}
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("catalog.agenda.upcomingEmpty")}</p>
        ) : (
          <table className="agenda-upcoming">
            <thead>
              <tr>
                <th>{t("catalog.orders.columns.number")}</th>
                <th>{t("catalog.orders.columns.customer")}</th>
                <th>{t("catalog.orders.columns.status")}</th>
                <th>{t("catalog.agenda.columns.start")}</th>
                <th>{t("catalog.agenda.columns.end")}</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((item) => (
                <tr key={item.orderId}>
                  <td data-label={t("catalog.orders.columns.number")}>
                    <Link to={`/catalogo/pedidos/${item.orderId}`}>
                      {item.displayNumber ?? item.productName}
                    </Link>
                  </td>
                  <td data-label={t("catalog.orders.columns.customer")}>{item.customerName ?? "—"}</td>
                  <td data-label={t("catalog.orders.columns.status")}>
                    <span className="staff-catalog-status" data-tone={STAFF_ORDER_STATUS_TONE[item.orderStatus]}>
                      {t(`catalog.status.${item.orderStatus}`)}
                    </span>
                  </td>
                  <td data-label={t("catalog.agenda.columns.start")}>
                    {item.workStart
                      ? formatCatalogDate(item.workStart, i18n.language, timeZoneId)
                      : t("catalog.agenda.unscheduled")}
                  </td>
                  <td data-label={t("catalog.agenda.columns.end")}>
                    {item.workEnd ? formatCatalogDate(item.workEnd, i18n.language, timeZoneId) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
