import { useTranslation } from "react-i18next"

import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { formatLocaleCurrency } from "@/lib/localeFormat"

type RentalResourceDetailsProps = {
  asset: AdminRentalAsset
  pricePerHour: number | null | undefined
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

export function RentalResourceDetails({ asset, pricePerHour }: RentalResourceDetailsProps) {
  const { i18n, t } = useTranslation()
  const durations = formatAllowedDurations(asset.allowedDurationMinutes, t)
  const details = [
    pricePerHour != null
      ? t("rentals.resources.details.pricePerHour", { amount: formatLocaleCurrency(pricePerHour, "BRL", i18n.language) })
      : null,
    durations !== null ? t("rentals.resources.details.allowedDurations", { durations }) : null,
    typeof asset.capacityPeople === "number" && asset.capacityPeople > 0
      ? t("rentals.resources.details.capacity", { count: asset.capacityPeople })
      : t("rentals.resources.details.capacityUnknown"),
  ].filter((detail): detail is string => detail !== null)

  if (details.length === 0) return null

  return (
    <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
  )
}
