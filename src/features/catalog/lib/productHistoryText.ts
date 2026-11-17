import type { TFunction } from "i18next"

import { formatCatalogMoney, type CatalogProductHistoryChange, type CatalogProductHistoryEntry } from "@/features/catalog/schemas/catalogSchemas"
import { resolveTenantTimeZone } from "@/lib/tenantTimeZone"

const BASE = "catalog.products.view.history"

const ACTION_SENTENCE: Record<string, string> = {
  "product.created": `${BASE}.actions.created`,
  "product.activated": `${BASE}.actions.activated`,
  "product.deactivated": `${BASE}.actions.deactivated`,
  "product.deleted": `${BASE}.actions.deleted`,
  "product.requirementsChanged": `${BASE}.actions.requirementsChanged`,
}

const KNOWN_FIELDS = new Set([
  "name", "code", "description", "price", "currency", "usesSchedule", "isActive", "categories", "tags",
  "visibility", "accessCustomers", "accessGroups", "resourceRequirements",
])

export type ProductHistoryTextContext = {
  t: TFunction
  locale: string
  /** Product currency, used to format price changes. */
  currency: string
}

function formatValue(field: string, value: string | null, ctx: ProductHistoryTextContext): string {
  if (value == null) return ""
  if (field === "price") {
    const amount = Number(value)
    return Number.isFinite(amount) ? formatCatalogMoney(amount, ctx.currency, ctx.locale) ?? value : value
  }
  if (field === "usesSchedule" || field === "isActive") {
    return ctx.t(`${BASE}.${value === "true" ? "yes" : "no"}`)
  }
  if (field === "visibility") {
    if (value === "Public") return ctx.t("catalog.products.access.public")
    if (value === "Restricted") return ctx.t("catalog.products.access.restricted")
  }
  return value
}

/** One readable sentence for a changed field, e.g. "Preço alterado de R$ 40,00 para R$ 45,00". */
function describeChange(change: CatalogProductHistoryChange, ctx: ProductHistoryTextContext): string {
  const { field } = change
  if (!KNOWN_FIELDS.has(field)) return ctx.t(`${BASE}.actions.unknownField`)
  if (field === "description") return ctx.t(`${BASE}.fields.description.text`)
  const oldValue = formatValue(field, change.old, ctx)
  const newValue = formatValue(field, change.new, ctx)
  const form = change.old == null ? "set" : change.new == null ? "cleared" : "changed"
  return ctx.t(`${BASE}.fields.${field}.${form}`, { old: oldValue, new: newValue, interpolation: { escapeValue: false } })
}

/** The "what" of a history entry in the active language. Never exposes raw action or field codes. */
export function describeProductHistoryEntry(entry: CatalogProductHistoryEntry, ctx: ProductHistoryTextContext): string {
  const { t } = ctx
  const noEscape = { interpolation: { escapeValue: false } }
  const fileName = (side: "old" | "new") => entry.changes.find((change) => change.field === "file")?.[side] ?? ""
  switch (entry.action) {
    case "product.fileAdded":
      return t(`${BASE}.actions.fileAdded`, { name: fileName("new"), ...noEscape })
    case "product.fileRemoved":
      return t(`${BASE}.actions.fileRemoved`, { name: fileName("old"), ...noEscape })
    case "product.duplicated": {
      const source = entry.changes.find((change) => change.field === "source")
      return source != null
        ? t(`${BASE}.actions.copiedFrom`, { name: source.old ?? "", ...noEscape })
        : t(`${BASE}.actions.copyCreated`)
    }
    case "product.updated":
    case "product.taxonomyChanged":
    case "product.accessChanged": {
      const sentences = entry.changes.map((change) => describeChange(change, ctx))
      return sentences.length > 0 ? sentences.join("; ") : t(`${BASE}.actions.changed`)
    }
    default: {
      const key = ACTION_SENTENCE[entry.action]
      return key != null ? t(key) : t(`${BASE}.actions.changed`)
    }
  }
}

/** "12/11 14:30" on the tenant clock; the year is added only for entries from another year. */
export function formatProductHistoryDate(value: string, locale: string, timeZoneId: string, now: Date = new Date()): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const timeZone = resolveTenantTimeZone(timeZoneId)
  const year = (instant: Date) => new Intl.DateTimeFormat("en", { timeZone, year: "numeric" }).format(instant)
  const sameYear = year(date) === year(now)
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    ...(sameYear ? {} : { year: "2-digit" }),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date).replace(/[\u202F\u00A0]/g, " ")
}
