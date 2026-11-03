import type { TFunction } from "i18next"

import {
  formatCatalogDate,
  type CatalogOrder,
} from "@/features/catalog/schemas/catalogSchemas"

/**
 * Customer-facing readiness line for a portal order. Never exposes resource,
 * equipment or allocation details — only a date (on the tenant clock), a
 * "to be confirmed" note, or a vague delay notice.
 *
 * - estimatedReadyAt present (and not Blocked): "Ready for pickup: <date/time>"
 * - Unscheduled/Scheduled without estimatedReadyAt: "Estimate to be confirmed"
 * - Blocked: vague delay notice, no numeric date
 * - NotRequired (or anything else without a date): nothing
 */
export function portalOrderReadinessText(
  order: Pick<CatalogOrder, "productionSummary" | "estimatedReadyAt">,
  t: TFunction,
  locale: string,
  timeZoneId: string,
): string | null {
  const { productionSummary, estimatedReadyAt } = order
  if (productionSummary === "NotRequired") return null
  if (productionSummary === "Blocked") {
    return t("tenantPortal.catalog.readiness.delayed")
  }
  if (estimatedReadyAt) {
    return t("tenantPortal.catalog.readiness.readyAt", {
      date: formatCatalogDate(estimatedReadyAt, locale, timeZoneId),
    })
  }
  if (productionSummary === "Unscheduled" || productionSummary === "Scheduled") {
    return t("tenantPortal.catalog.readiness.toConfirm")
  }
  return null
}
