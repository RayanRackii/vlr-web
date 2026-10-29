import { PageHeader } from "@/components/layout/PageHeader"
import { CalendarDays, Globe2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { formatTenantTimeZoneLabel } from "@/features/tenantPortal/lib/tenantTimeZoneLabel"

export function ReservationsHeader({ date }: { date?: string }) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()

  return (
    <header className="reservations-heading">
      <PageHeader
        icon={CalendarDays}
        title={t("rentals.reservations.title")}
        description={t("rentals.reservations.description")}
        className="mb-0 sm:mb-0"
      />
      <p className="reservations-timezone" data-testid="tenant-tz-label">
        <Globe2 size={16} aria-hidden="true" />
        {formatTenantTimeZoneLabel(timeZoneId, i18n.language, date)}
      </p>
    </header>
  )
}
