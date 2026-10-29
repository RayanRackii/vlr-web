import { Globe2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { formatTenantTimeZoneLabel } from "@/features/tenantPortal/lib/tenantTimeZoneLabel"

export function ReservationsHeader({ date }: { date?: string }) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()

  return (
    <header className="reservations-heading">
      <p className="reservations-eyebrow">{t("rentals.reservations.operation")}</p>
      <h1>{t("rentals.reservations.title")}</h1>
      <p className="reservations-description">{t("rentals.reservations.description")}</p>
      <p className="reservations-timezone" data-testid="tenant-tz-label">
        <Globe2 size={16} aria-hidden="true" />
        {formatTenantTimeZoneLabel(timeZoneId, i18n.language, date)}
      </p>
    </header>
  )
}
