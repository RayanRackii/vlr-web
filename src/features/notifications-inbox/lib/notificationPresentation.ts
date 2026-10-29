import type { TFunction } from "i18next"
import type { NotificationItem } from "../schemas/notificationInboxSchemas"
import { CalendarCheck, Package, Bell, type LucideIcon } from "lucide-react"

/**
 * Maps an API event type to an i18n label slug under
 * `notifications.inbox.groups.<slug>` with a `{{count}}` plural. The match is
 * tolerant of separator/casing variance (`catalog.order.created`,
 * `Catalog.Order.Created`, `catalog_order_created` all normalize the same) so a
 * contract tweak on the API side does not silently drop a label. Unknown event
 * types return `null`, and the caller renders the generic fallback.
 */
const GROUP_LABEL_RULES: ReadonlyArray<{ test: (n: string) => boolean; slug: string }> = [
  // Order rules — the "cancelled by …" variants must win over the bare "cancel".
  { test: (n) => n.includes("ordercreated"), slug: "orderCreated" },
  { test: (n) => n.includes("orderapproved"), slug: "orderApproved" },
  { test: (n) => n.includes("orderready"), slug: "orderReady" },
  { test: (n) => n.includes("orderrejected"), slug: "orderRejected" },
  {
    test: (n) => n.includes("order") && n.includes("cancel") && n.includes("supplier"),
    slug: "orderCancelledBySupplier",
  },
  {
    test: (n) => n.includes("order") && n.includes("cancel") && n.includes("customer"),
    slug: "orderCancelledByCustomer",
  },
  { test: (n) => n.includes("order") && n.includes("cancel"), slug: "orderCancelledBySupplier" },
  // Reservation rules.
  { test: (n) => n.includes("reservation") && n.includes("confirmed"), slug: "reservationConfirmed" },
  {
    test: (n) => n.includes("reservation") && (n.includes("pendingdeposit") || n.includes("deposit")),
    slug: "reservationPendingDeposit",
  },
  { test: (n) => n.includes("reservation") && n.includes("completed"), slug: "reservationCompleted" },
  { test: (n) => n.includes("reservation") && n.includes("reminder"), slug: "reservationReminder" },
  { test: (n) => n.includes("reservation") && n.includes("cancel"), slug: "reservationCanceled" },
]

function normalizeEventType(eventType: string): string {
  return eventType.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function groupLabelSlug(eventType: string): string | null {
  const normalized = normalizeEventType(eventType)
  return GROUP_LABEL_RULES.find((rule) => rule.test(normalized))?.slug ?? null
}

/** Preserve the API's item-specific title, with localized text for blank titles. */
export function notificationItemText(
  item: Pick<NotificationItem, "eventType" | "title">,
  t: TFunction,
): string {
  const title = item.title.trim()
  if (title) {
    return title
  }
  const slug = groupLabelSlug(item.eventType)
  return slug ? t(`notifications.inbox.items.${slug}`) : title
}

/** Module glyph shown beside each group; unknown modules fall back to the bell. */
const MODULE_ICONS: Record<string, LucideIcon> = {
  catalog: Package,
  rentals: CalendarCheck,
}

export function moduleIcon(module: string): LucideIcon {
  return MODULE_ICONS[module] ?? Bell
}

/**
 * Staff routes live at the app root (not under the `/t/<slug>` portal prefix),
 * and the catalog orders / rentals reservations screens sit at module-specific
 * paths that differ from the tenant-relative `targetRoute` the API emits
 * (`/pedidos`, `/reservas`). Rebase onto the real staff path by module while
 * preserving the query string the API chose (e.g. `?status=pending`).
 */
const MODULE_STAFF_ROUTE: Record<string, string> = {
  catalog: "/catalogo/pedidos",
  rentals: "/configuracoes/reservas",
}

export function resolveStaffRoute(module: string, targetRoute: string): string {
  const base = MODULE_STAFF_ROUTE[module]
  if (!base) {
    return targetRoute
  }
  const queryIndex = targetRoute.search(/[?#]/)
  const suffix = queryIndex === -1 ? "" : targetRoute.slice(queryIndex)
  return `${base}${suffix}`
}

export function resolveNotificationItemRoute(
  item: Pick<NotificationItem, "module" | "eventType" | "aggregateId" | "targetRoute">,
): string {
  const orderId = item.aggregateId?.trim()
  if (item.module === "catalog" && item.eventType.toLowerCase().includes("order") && orderId) {
    return `/catalogo/pedidos/${encodeURIComponent(orderId)}`
  }
  return resolveStaffRoute(item.module, item.targetRoute)
}

const RELATIVE_THRESHOLDS: ReadonlyArray<{ limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { limit: 60, divisor: 1, unit: "second" },
  { limit: 3600, divisor: 60, unit: "minute" },
  { limit: 86400, divisor: 3600, unit: "hour" },
  { limit: 604800, divisor: 86400, unit: "day" },
  { limit: 2592000, divisor: 604800, unit: "week" },
  { limit: 31536000, divisor: 2592000, unit: "month" },
  { limit: Number.POSITIVE_INFINITY, divisor: 31536000, unit: "year" },
]

/** Locale-aware "há 3 min" / "3 min ago" from an ISO instant. */
export function formatRelativeTime(iso: string, locale: string, now: Date = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) {
    return iso
  }
  const diffSeconds = Math.round((then.getTime() - now.getTime()) / 1000)
  const magnitude = Math.abs(diffSeconds)
  const { divisor, unit } = RELATIVE_THRESHOLDS.find((entry) => magnitude < entry.limit) ?? RELATIVE_THRESHOLDS[RELATIVE_THRESHOLDS.length - 1]
  const value = Math.round(diffSeconds / divisor)
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit)
  } catch {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(value, unit)
  }
}
