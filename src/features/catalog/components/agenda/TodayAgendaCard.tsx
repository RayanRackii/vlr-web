import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { CalendarClock, ChevronRight, Package, Wrench } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import {
  addCivilDays,
  civilToday,
  columnsToRange,
  formatZonedTime,
} from "@/features/catalog/components/agenda/agendaLayout"
import type { CatalogAgendaItem } from "@/features/catalog/schemas/catalogSchemas"
import {
  listCatalogProductAgenda,
  listCatalogResourceAgenda,
} from "@/features/catalog/services/catalogService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

const MAX_ROWS = 6
const RESOURCE_ROUTE = "/catalogo/agenda-recursos"
const PRODUCT_ROUTE = "/catalogo/agenda-produto"

type AgendaMode = "resource" | "product"

type StatusKey = "inUse" | "prep" | "cleaning" | "overdue" | "free"

/** Lower index = shown first; the most relevant live state wins per row. */
const PRIORITY: readonly StatusKey[] = ["inUse", "prep", "cleaning", "overdue", "free"]

const TONE: Record<StatusKey, "info" | "warning" | "destructive" | "outline"> = {
  inUse: "info",
  prep: "info",
  cleaning: "warning",
  overdue: "destructive",
  free: "outline",
}

type RowState = {
  key: StatusKey
  /** Item driving the live status (null when idle). */
  item: CatalogAgendaItem | null
  /** Next upcoming item for an idle row (null when nothing else today). */
  next: CatalogAgendaItem | null
}

type AgendaRow = {
  id: string
  name: string
  state: RowState
}

function parse(value: string | null): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

function classifyItem(item: CatalogAgendaItem, now: number): StatusKey {
  const ws = parse(item.workStart)
  const we = parse(item.workEnd)
  const os = parse(item.occupiedStart)
  const oe = parse(item.occupiedEnd)
  const alloc = item.allocationStatus
  if ((ws != null && we != null && now >= ws && now < we) || alloc === "Running") return "inUse"
  if (os != null && ws != null && now >= os && now < ws) return "prep"
  if ((we != null && oe != null && now >= we && now < oe) || alloc === "Cleaning") return "cleaning"
  if (alloc === "Scheduled" && ws != null && ws < now) return "overdue"
  return "free"
}

/** Collapse one resource/product's items into the single state shown on its row. */
function rowState(items: CatalogAgendaItem[], now: number, isToday: (ms: number) => boolean): RowState {
  const live = items.filter(
    (item) => item.allocationStatus !== "Released" && item.allocationStatus !== "Cancelled",
  )
  let best: { item: CatalogAgendaItem; key: StatusKey } | null = null
  for (const item of live) {
    const key = classifyItem(item, now)
    if (!best || PRIORITY.indexOf(key) < PRIORITY.indexOf(best.key)) best = { item, key }
  }
  if (!best || best.key === "free") {
    const next =
      live
        .map((item) => ({ item, at: parse(item.workStart) ?? parse(item.occupiedStart) }))
        .filter((x): x is { item: CatalogAgendaItem; at: number } => x.at != null && x.at > now && isToday(x.at))
        .sort((a, b) => a.at - b.at)[0]?.item ?? null
    return { key: "free", item: null, next }
  }
  return { key: best.key, item: best.item, next: null }
}

/** Tenant-local "today" plus one civil day each side (UTC-day columns, like the agenda pages),
 *  so items around midnight in any offset are included; rows only count today's items. */
function todayRange(timeZoneId: string): { from: string; to: string; today: string } {
  const today = civilToday(timeZoneId)
  return { ...columnsToRange([addCivilDays(today, -1), addCivilDays(today, 1)]), today }
}

function civilDayOf(ms: number, timeZoneId: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms))
}

export function TodayAgendaCard() {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const { can, activeModules } = usePermissions()

  // The agenda endpoints sit behind the Catalog module gate.
  const catalogActive = activeModules.includes("catalog")
  const mode: AgendaMode | null = !catalogActive
    ? null
    : can("rentals.schedule.read")
    ? "resource"
    : can("catalog.orders.read")
      ? "product"
      : null

  const [range] = useState(() => todayRange(timeZoneId))
  // Snapshot of "now" taken once per mount (render stays pure).
  const [now] = useState(() => Date.now())
  const [items, setItems] = useState<CatalogAgendaItem[]>([])
  const [resources, setResources] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const requestKey = mode ? `${mode}|${range.from}|${attempt}` : null
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  // Derive loading from loaded-vs-requested so the effect never setState's synchronously.
  const loading = requestKey !== null && loadedKey !== requestKey

  useEffect(() => {
    if (!mode) return
    let cancelled = false
    const load =
      mode === "resource"
        ? listCatalogResourceAgenda({ from: range.from, to: range.to }).then((data) => {
            if (cancelled) return
            setItems(data.items)
            setResources(data.resources.map((r) => ({ id: r.id, name: r.name })))
            setError(null)
          })
        : listCatalogProductAgenda({ from: range.from, to: range.to }).then((data) => {
            if (cancelled) return
            setItems(data)
            setResources([])
            setError(null)
          })
    void load
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : t("apiErrors.loadCatalogAgenda"))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey)
      })
    return () => {
      cancelled = true
    }
  }, [mode, range, requestKey, t])

  const isToday = useMemo(() => {
    return (ms: number) => civilDayOf(ms, timeZoneId) === range.today
  }, [timeZoneId, range.today])

  const rows = useMemo<AgendaRow[]>(() => {
    if (mode === "resource") {
      return resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        state: rowState(
          items.filter((item) => item.rentalAssetId === resource.id),
          now,
          isToday,
        ),
      }))
    }
    if (mode === "product") {
      const byProduct = new Map<string, { name: string; items: CatalogAgendaItem[] }>()
      for (const item of items) {
        const entry = byProduct.get(item.productId) ?? { name: item.productName, items: [] }
        entry.items.push(item)
        byProduct.set(item.productId, entry)
      }
      return [...byProduct.entries()].map(([id, entry]) => ({
        id,
        name: entry.name,
        state: rowState(entry.items, now, isToday),
      }))
    }
    return []
  }, [mode, resources, items, now, isToday])

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const byStatus = PRIORITY.indexOf(a.state.key) - PRIORITY.indexOf(b.state.key)
        return byStatus !== 0 ? byStatus : a.name.localeCompare(b.name, i18n.language)
      }),
    [rows, i18n.language],
  )

  if (!mode) return null

  const route = mode === "resource" ? RESOURCE_ROUTE : PRODUCT_ROUTE
  const RowIcon = mode === "resource" ? Wrench : Package
  const reserved = t("catalog.todayAgenda.reserved")
  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    day: "2-digit",
    month: "short",
  }).format(new Date(range.from))

  function occupantRef(item: CatalogAgendaItem): string {
    return item.displayNumber ? `#${item.displayNumber}` : reserved
  }

  function subLine(state: RowState): string {
    const fmt = (value: string | null, tz: string) =>
      value ? formatZonedTime(value, i18n.language, tz) : "—"
    switch (state.key) {
      case "inUse":
        return t("catalog.todayAgenda.sub.inUse", {
          ref: occupantRef(state.item!),
          time: fmt(state.item!.workEnd ?? state.item!.occupiedEnd, state.item!.timeZoneId),
        })
      case "prep":
        return t("catalog.todayAgenda.sub.prep", {
          ref: occupantRef(state.item!),
          time: fmt(state.item!.workStart, state.item!.timeZoneId),
        })
      case "cleaning":
        return t("catalog.todayAgenda.sub.cleaning", {
          ref: occupantRef(state.item!),
          time: fmt(state.item!.occupiedEnd ?? state.item!.workEnd, state.item!.timeZoneId),
        })
      case "overdue": {
        const late = parse(state.item!.workStart)
        return t("catalog.todayAgenda.sub.overdue", {
          minutes: late != null ? Math.max(0, Math.round((now - late) / 60000)) : 0,
        })
      }
      default:
        return state.next
          ? t("catalog.todayAgenda.sub.freeNext", {
              ref: occupantRef(state.next),
              time: fmt(state.next.workStart ?? state.next.occupiedStart, state.next.timeZoneId),
            })
          : t("catalog.todayAgenda.sub.freeNone")
    }
  }

  const visibleRows = sortedRows.slice(0, MAX_ROWS)

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarClock className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t("catalog.todayAgenda.title")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("catalog.todayAgenda.subtitle", { date: dateLabel })}
            </p>
          </div>
        </div>
        <Link to={route} className="text-sm font-semibold text-primary">
          {t("catalog.todayAgenda.viewAll")} →
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2" role="status" aria-label={t("catalog.staff.loading")}>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t("common.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : visibleRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("catalog.todayAgenda.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {visibleRows.map((row) => (
              <li key={row.id}>
                <Link
                  to={route}
                  className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted"
                >
                  <RowIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{subLine(row.state)}</p>
                  </div>
                  <Badge variant={TONE[row.state.key]}>
                    {t(`catalog.todayAgenda.status.${row.state.key}`)}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    {t("catalog.todayAgenda.rowLink")}
                    <ChevronRight className="size-3" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && sortedRows.length > MAX_ROWS ? (
          <Link to={route} className="mt-3 inline-flex text-sm font-semibold text-primary">
            {t("catalog.todayAgenda.seeAll")}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}
