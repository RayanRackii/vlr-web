import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { CalendarDays, X } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { CatalogHeading } from "@/features/catalog/components/StaffCatalogChrome"
import {
  agendaColumnLabels,
  buildDayColumns,
  buildResourceAgendaRows,
  civilToday,
  columnsToRange,
  formatDayLabel,
  formatZonedTime,
  zonedDayAndMinutes,
  startOfCivilWeek,
  addCivilDays,
  type AgendaResourceBlock,
  type AgendaView,
} from "@/features/catalog/components/agenda/agendaLayout"
import "@/features/catalog/components/agenda/agenda.css"
import { STAFF_ORDER_STATUS_TONE } from "@/features/catalog/lib/catalogStatusBadge"
import type {
  CatalogAgendaItem,
  CatalogAgendaResource,
} from "@/features/catalog/schemas/catalogSchemas"
import { listCatalogResourceAgenda } from "@/features/catalog/services/catalogService"

function initialView(): AgendaView {
  return window.matchMedia?.("(max-width: 767px)").matches ? "day" : "week"
}

/** Block / panel label — never leaks null customer data. */
function occupantLabel(item: CatalogAgendaItem, reserved: string): string {
  return item.displayNumber ?? item.customerName ?? reserved
}

export function CatalogResourceAgendaPage() {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()

  const [view, setView] = useState<AgendaView>(initialView)
  const [anchor, setAnchor] = useState<string>(() => civilToday(timeZoneId))
  const [items, setItems] = useState<CatalogAgendaItem[]>([])
  const [resources, setResources] = useState<CatalogAgendaResource[]>([])
  const [category, setCategory] = useState<string>("")
  const [resourceId, setResourceId] = useState<string>("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const columns = useMemo(() => buildDayColumns(anchor, view), [anchor, view])
  const range = useMemo(() => columnsToRange(columns), [columns])

  const agendaKey = `${range.from}|${range.to}`
  // Derive loading from loaded-vs-requested so the effect never setState's synchronously.
  const loading = loadedKey !== agendaKey

  useEffect(() => {
    let cancelled = false
    void listCatalogResourceAgenda(range)
      .then((data) => {
        if (cancelled) return
        setItems(data.items)
        setResources(data.resources)
        setLoadError(null)
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
  }, [range, agendaKey, t])

  const categories = useMemo(() => {
    const unique = new Set<string>()
    for (const resource of resources) {
      if (resource.category) unique.add(resource.category)
    }
    return [...unique].sort((a, b) => a.localeCompare(b, i18n.language))
  }, [resources, i18n.language])

  const visibleResources = useMemo(
    () =>
      resources.filter(
        (resource) =>
          (!category || resource.category === category) &&
          (!resourceId || resource.id === resourceId),
      ),
    [resources, category, resourceId],
  )

  const columnLabels = useMemo(
    () => agendaColumnLabels(columns, view, i18n.language),
    [columns, view, i18n.language],
  )

  const rows = useMemo(
    () => buildResourceAgendaRows(items, visibleResources, columns, view),
    [items, visibleResources, columns, view],
  )

  const selected = useMemo(
    () => items.find((item) => item.orderId === selectedId) ?? null,
    [items, selectedId],
  )

  const weekStart = startOfCivilWeek(anchor)
  const fmtDay = (civil: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: "2-digit", month: "short", timeZone: "UTC" }).format(
      new Date(`${civil}T00:00:00Z`),
    )
  const periodLabel =
    view === "week"
      ? t("catalog.agenda.weekRange", { from: fmtDay(weekStart), to: fmtDay(addCivilDays(weekStart, 6)) })
      : new Intl.DateTimeFormat(i18n.language, {
          weekday: "long",
          day: "2-digit",
          month: "long",
          timeZone: "UTC",
        }).format(new Date(`${anchor}T00:00:00Z`))

  const step = view === "week" ? 7 : 1

  const renderStackBlock = (block: AgendaResourceBlock) => {
    const label = occupantLabel(block.item, t("catalog.resourceAgenda.reserved"))
    const zone = block.item.timeZoneId
    const work = block.item.workStart && block.item.workEnd
      ? `${formatZonedTime(block.item.workStart, i18n.language, zone)}–${formatZonedTime(block.item.workEnd, i18n.language, zone)}`
      : t("catalog.agenda.unscheduled")
    return (
      <button
        key={block.key}
        type="button"
        className="agenda-stack-group"
        aria-pressed={block.item.orderId === selectedId}
        onClick={() => setSelectedId(block.item.orderId)}
      >
        <span className="agenda-stack-title">{label}</span>
        <span className="agenda-stack-row">
          <span>{t("catalog.resourceAgenda.panel.work")}</span>
          <time>{work}</time>
        </span>
      </button>
    )
  }

  const renderBlock = (block: AgendaResourceBlock) => {
    const label = occupantLabel(block.item, t("catalog.resourceAgenda.reserved"))
    const reserved = block.item.displayNumber == null
    return (
      <button
        key={block.key}
        type="button"
        className="agenda-block resource-block"
        data-selected={block.item.orderId === selectedId}
        style={{ left: `${block.leftPct}%`, width: `${block.widthPct}%` }}
        title={label}
        aria-label={label}
        onClick={() => setSelectedId(block.item.orderId)}
      >
        {block.segments.map((segment, index) => (
          <div
            key={`${segment.kind}-${index}`}
            className="agenda-seg"
            data-kind={segment.kind}
            data-reserved={segment.kind === "work" ? reserved : undefined}
            style={{ width: `${segment.widthPct}%` }}
          >
            {segment.kind === "work" ? label : null}
          </div>
        ))}
      </button>
    )
  }

  return (
    <div className="staff-catalog">
      <CatalogHeading
        title={t("catalog.resourceAgenda.title")}
        description={t("catalog.resourceAgenda.subtitle")}
        actions={
          <div className="flex gap-1" role="group" aria-label={t("catalog.agenda.viewLabel")}>
            <Button
              type="button"
              variant={view === "day" ? "default" : "outline"}
              size="sm"
              aria-pressed={view === "day"}
              onClick={() => setView("day")}
            >
              {t("catalog.agenda.day")}
            </Button>
            <Button
              type="button"
              variant={view === "week" ? "default" : "outline"}
              size="sm"
              aria-pressed={view === "week"}
              onClick={() => setView("week")}
            >
              {t("catalog.agenda.week")}
            </Button>
          </div>
        }
      />

      {loadError ? (
        <Alert variant="destructive" className="staff-catalog-error">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="staff-catalog-card flex flex-wrap gap-4">
        <label className="staff-catalog-search">
          {t("catalog.resourceAgenda.categoryLabel")}
          <select
            className="touch-target min-h-11 rounded-lg border border-input bg-background px-3"
            aria-label={t("catalog.resourceAgenda.categoryLabel")}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{t("catalog.resourceAgenda.allCategories")}</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="staff-catalog-search">
          {t("catalog.resourceAgenda.resourceLabel")}
          <select
            className="touch-target min-h-11 rounded-lg border border-input bg-background px-3"
            aria-label={t("catalog.resourceAgenda.resourceLabel")}
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
          >
            <option value="">{t("catalog.resourceAgenda.allResources")}</option>
            {resources
              .filter((resource) => !category || resource.category === category)
              .map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] items-start mt-4">
        <div className="staff-catalog-card" aria-busy={loading}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} aria-hidden="true" />
              <h2 className="text-sm font-semibold">{periodLabel}</h2>
            </div>
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
          </div>

          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("catalog.staff.loading")}
            </p>
          ) : visibleResources.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("catalog.resourceAgenda.noResources")}</p>
          ) : (
            <>
            <div className="resource-agenda-scroll">
              <div className="resource-agenda">
                <div className="resource-agenda-head">
                  <div className="resource-cell">{t("catalog.resourceAgenda.resourceColumn")}</div>
                  <div className="resource-agenda-labels">
                    {columnLabels.map((label, index) => (
                      <span key={`${label}-${index}`}>{label}</span>
                    ))}
                  </div>
                </div>
                {rows.map((row) => (
                  <div className="resource-agenda-row" key={row.resource.id}>
                    <div className="resource-cell">
                      <strong>{row.resource.name}</strong>
                      {row.resource.category ? <span>{row.resource.category}</span> : null}
                    </div>
                    <div className="resource-track" role="list" aria-label={row.resource.name}>
                      <div className="resource-gridlines" aria-hidden="true">
                        {columnLabels.map((label, index) => (
                          <span key={`${label}-${index}`} />
                        ))}
                      </div>
                      {row.blocks.map(renderBlock)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="resource-agenda-stack" data-testid="resource-agenda-stack">
              {rows.map((row) => (
                <section key={row.resource.id} aria-label={row.resource.name}>
                  <h3>{row.resource.name}</h3>
                  {row.resource.category ? <p className="text-xs text-muted-foreground">{row.resource.category}</p> : null}
                  {row.blocks.length === 0 ? (
                    <p className="agenda-empty-day">{t("catalog.agenda.free")}</p>
                  ) : columns.length > 1 ? columns.map((day) => {
                    const dayBlocks = row.blocks.filter((block) => {
                      if (!block.item.occupiedStart) return false
                      return zonedDayAndMinutes(block.item.occupiedStart, block.item.timeZoneId)?.dayKey === day
                    })
                    if (dayBlocks.length === 0) return null
                    return (
                      <div key={day}>
                        <h4 className="text-xs font-medium text-muted-foreground">{formatDayLabel(day, i18n.language)}</h4>
                        {dayBlocks.map(renderStackBlock)}
                      </div>
                    )
                  }) : row.blocks.map(renderStackBlock)}
                </section>
              ))}
            </div>
            </>
          )}
        </div>

        {selected ? (
          <aside className="staff-catalog-card resource-agenda-panel" aria-label={t("catalog.resourceAgenda.panel.title")}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-semibold">{occupantLabel(selected, t("catalog.resourceAgenda.reserved"))}</h2>
                <p className="text-xs text-muted-foreground">{selected.resourceName ?? "—"}</p>
              </div>
              <button
                type="button"
                className="touch-target"
                aria-label={t("catalog.resourceAgenda.panel.close")}
                onClick={() => setSelectedId(null)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("catalog.resourceAgenda.panel.product")}</dt>
                <dd className="text-end">{selected.productName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("catalog.resourceAgenda.panel.status")}</dt>
                <dd>
                  <span className="staff-catalog-status" data-tone={STAFF_ORDER_STATUS_TONE[selected.orderStatus]}>
                    {t(`catalog.status.${selected.orderStatus}`)}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("catalog.resourceAgenda.panel.work")}</dt>
                <dd>
                  {selected.workStart && selected.workEnd
                    ? `${formatZonedTime(selected.workStart, i18n.language, selected.timeZoneId)}–${formatZonedTime(selected.workEnd, i18n.language, selected.timeZoneId)}`
                    : t("catalog.agenda.unscheduled")}
                </dd>
              </div>
              {selected.occupiedStart && selected.workStart ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("catalog.resourceAgenda.panel.prep")}</dt>
                  <dd>
                    {formatZonedTime(selected.occupiedStart, i18n.language, selected.timeZoneId)}–
                    {formatZonedTime(selected.workStart, i18n.language, selected.timeZoneId)}
                  </dd>
                </div>
              ) : null}
              {selected.workEnd && selected.occupiedEnd ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("catalog.resourceAgenda.panel.cleanup")}</dt>
                  <dd>
                    {formatZonedTime(selected.workEnd, i18n.language, selected.timeZoneId)}–
                    {formatZonedTime(selected.occupiedEnd, i18n.language, selected.timeZoneId)}
                  </dd>
                </div>
              ) : null}
            </dl>
            {selected.displayNumber ? (
              <Link
                to={`/catalogo/pedidos/${selected.orderId}`}
                className="mt-4 inline-flex text-sm font-semibold text-primary"
              >
                {t("catalog.resourceAgenda.panel.openOrder")}
              </Link>
            ) : null}
          </aside>
        ) : (
          <aside className="staff-catalog-card hidden lg:block">
            <p className="text-sm text-muted-foreground">{t("catalog.resourceAgenda.panel.empty")}</p>
          </aside>
        )}
      </div>
    </div>
  )
}
