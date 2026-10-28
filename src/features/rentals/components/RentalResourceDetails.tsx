import { useTranslation } from "react-i18next"
import type { PricingUnit } from "@/api/generated/rentalPricing"

import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { formatLocaleCurrency } from "@/lib/localeFormat"

type RentalResourceDetailsProps = {
  asset: AdminRentalAsset
  pricePerHour: number | null | undefined
  pricingUnit?: PricingUnit
  /** List rows: metadata and a responsive price column. */
  compact?: boolean
  showUnpriced?: boolean
}

function formatAllowedDurations(
  allowedDurationMinutes: string | null | undefined,
  format: (key: string, options: { count: number }) => string,
): string | null {
  const durations = (allowedDurationMinutes ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)

  if (durations.length === 0) return null

  return durations
    .map((minutes) => minutes % 60 === 0
      ? format("rentals.resources.details.durationHours", { count: minutes / 60 })
      : format("rentals.resources.details.durationMinutes", { count: minutes }))
    .join(", ")
}

export function RentalResourceDetails({ asset, pricePerHour, pricingUnit = "Hour", compact = false, showUnpriced = false }: RentalResourceDetailsProps) {
  const { i18n, t } = useTranslation()
  const durations = formatAllowedDurations(asset.allowedDurationMinutes, t)
  const priceLabel =
    pricePerHour != null
      ? t(`rentals.resources.details.prices.${pricingUnit}`, { amount: formatLocaleCurrency(pricePerHour, "BRL", i18n.language) })
      : null
  const hasCapacity = typeof asset.capacityPeople === "number" && asset.capacityPeople > 0
  const meta = [
    durations !== null ? t("rentals.resources.details.allowedDurations", { durations }) : null,
    hasCapacity
      ? t("rentals.resources.details.capacity", { count: asset.capacityPeople })
      : t("rentals.resources.details.capacityUnknown"),
  ].filter((detail): detail is string => detail !== null)

  if (!compact) {
    const details = [priceLabel, ...meta].filter((detail): detail is string => detail !== null)
    if (details.length === 0) return null
    return <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
  }

  return (
    <div className="resource-row-details">
      {priceLabel ? (
        <span className="resource-price-inline">
          {priceLabel}
        </span>
      ) : null}
      <div className="resource-metadata">{meta.map((detail) => <span key={detail}>{detail}</span>)}</div>
      {pricePerHour != null ? (
        <span className="resource-price-column">
          <strong>{formatLocaleCurrency(pricePerHour, "BRL", i18n.language)}</strong>
          <small>{t("rentals.resources.details.priceCaption", { unit: t(`rentals.resources.details.priceUnits.${pricingUnit}`) })}</small>
        </span>
      ) : showUnpriced ? (
        <span className="resource-price-column"><small>{t("rentals.resources.details.noPrice")}</small></span>
      ) : null}
    </div>
  )
}
