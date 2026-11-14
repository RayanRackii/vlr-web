import { useTranslation } from "react-i18next"
import type { PricingUnit } from "@/api/generated/rentalPricing"

import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { formatLocaleCurrency } from "@/lib/localeFormat"

type RentalResourceDetailsProps = {
  asset: AdminRentalAsset
  pricePerHour: number | null | undefined
  pricingUnit?: PricingUnit
}

type PriceProps = {
  pricePerHour: number | null | undefined
  pricingUnit?: PricingUnit
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

function useResourcePriceLabel(pricePerHour: number | null | undefined, pricingUnit: PricingUnit) {
  const { i18n, t } = useTranslation()
  return pricePerHour != null
    ? t(`rentals.resources.details.prices.${pricingUnit}`, { amount: formatLocaleCurrency(pricePerHour, "BRL", i18n.language) })
    : null
}

/** Price cell: lowest price with its unit, or the neutral "no price" label when pricing is readable. */
export function RentalResourcePrice({ pricePerHour, pricingUnit = "Hour", showUnpriced = false }: PriceProps) {
  const { t } = useTranslation()
  const label = useResourcePriceLabel(pricePerHour, pricingUnit)
  if (label !== null) return <span className="text-sm font-medium text-foreground">{label}</span>
  if (showUnpriced) return <span className="text-sm text-muted-foreground">{t("rentals.resources.details.noPrice")}</span>
  return <span className="text-sm text-muted-foreground">—</span>
}

/** Allowed durations; `withLabel` adds the "Durações:" prefix (cards), the table column header already says it. */
export function RentalResourceDurations({ asset, withLabel = false }: { asset: AdminRentalAsset; withLabel?: boolean }) {
  const { t } = useTranslation()
  const durations = formatAllowedDurations(asset.allowedDurationMinutes, t)
  if (durations === null) return <span className="text-sm text-muted-foreground">—</span>
  return <span className="text-sm">{withLabel ? t("rentals.resources.details.allowedDurations", { durations }) : durations}</span>
}

/** Capacity; `withLabel` uses the full sentence (cards), otherwise just the number. */
export function RentalResourceCapacity({ asset, withLabel = false }: { asset: AdminRentalAsset; withLabel?: boolean }) {
  const { t } = useTranslation()
  const hasCapacity = typeof asset.capacityPeople === "number" && asset.capacityPeople > 0
  if (withLabel) {
    return (
      <span className="text-sm">
        {hasCapacity
          ? t("rentals.resources.details.capacity", { count: asset.capacityPeople })
          : t("rentals.resources.details.capacityUnknown")}
      </span>
    )
  }
  return hasCapacity
    ? <span className="text-sm tabular-nums">{asset.capacityPeople}</span>
    : <span className="text-sm text-muted-foreground">—</span>
}

/** One muted line: price, durations and capacity (editor summary). */
export function RentalResourceDetails({ asset, pricePerHour, pricingUnit = "Hour" }: RentalResourceDetailsProps) {
  const { t } = useTranslation()
  const priceLabel = useResourcePriceLabel(pricePerHour, pricingUnit)
  const durations = formatAllowedDurations(asset.allowedDurationMinutes, t)
  const hasCapacity = typeof asset.capacityPeople === "number" && asset.capacityPeople > 0
  const details = [
    priceLabel,
    durations !== null ? t("rentals.resources.details.allowedDurations", { durations }) : null,
    hasCapacity
      ? t("rentals.resources.details.capacity", { count: asset.capacityPeople })
      : t("rentals.resources.details.capacityUnknown"),
  ].filter((detail): detail is string => detail !== null)
  if (details.length === 0) return null
  return <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
}
