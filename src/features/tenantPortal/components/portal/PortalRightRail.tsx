import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { CalendarDays, Lightbulb } from "lucide-react"
import { useTranslation } from "react-i18next"
import { formatReservationRange } from "@/features/rentals/services/reservationsService"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import type { PortalReservation } from "@/features/tenantPortal/services/tenantPortalService"
import { focusBookingArea } from "@/features/tenantPortal/lib/focusBookingArea"

type Props = { nextReservation?: PortalReservation; reservationsHref: string }

export function PortalRightRail({ nextReservation, reservationsHref }: Props) {
  const { t } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  return (
    <aside className="portal-right-rail" aria-label={t("tenantPortal.redesign.bookingInfo")}>
      <section className="portal-rail-card portal-next-booking">
        <p>{t("tenantPortal.redesign.nextBooking")}</p>
        {nextReservation ? (
          <>
            <strong className="mt-2 block text-lg">{`${nextReservation.items.map((item) => item.assetName).join(", ")} · ${formatReservationRange(nextReservation.startDateTime, nextReservation.endDateTime, timeZoneId)}`}</strong>
          </>
        ) : (
          <EmptyState
            variant="portal"
            className="!border-0 !bg-transparent !p-0 [&_h2]:text-sm"
            title={t("tenantPortal.redesign.noNextBooking")}
            example={t("emptyStates.examples.bookings")}
            action={<Button type="button" onClick={focusBookingArea}>{t("emptyStates.book")}</Button>}
          />
        )}
        <a className="portal-rail-link" href={reservationsHref}>{t("tenantPortal.redesign.viewBookings")}</a>
      </section>
      <section className="portal-rail-card">
        <h2>{t("tenantPortal.redesign.legend")}</h2>
        <ul className="portal-legend">
          {(["free", "few", "full", "selected"] as const).map((state) => (
            <li key={state}><span className={`portal-dot portal-status-${state}`} aria-hidden="true" />{t(`tenantPortal.redesign.legend_${state}`)}</li>
          ))}
        </ul>
      </section>
      <section className="portal-rail-card flex items-center gap-3">
        <Lightbulb className="size-5 shrink-0 text-primary" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        <div><h2>{t("tenantPortal.redesign.tip")}</h2><p className="text-sm text-muted-foreground">{t("tenantPortal.redesign.tipText")}</p></div>
      </section>
    </aside>
  )
}

export function PortalBookingEmptyState() {
  const { t } = useTranslation()
  return (
    <EmptyState
      variant="portal"
      icon={CalendarDays}
      title={t("tenantPortal.redesign.emptyTitle")}
      description={t("tenantPortal.redesign.emptyHelp")}
    />
  )
}
