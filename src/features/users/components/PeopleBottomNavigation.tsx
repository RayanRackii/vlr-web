import { CalendarCheck, ClipboardList, LayoutDashboard, UserRound, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { filterNavigationTabs } from "@/components/layout/navigationTabs"
import { reservationTabs } from "@/features/rentals/navigationTabs"
import { peopleAccessTabs } from "@/features/users/navigationTabs"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

/** Reuse the existing tab destinations without importing route manifests into a page. */
export function PeopleBottomNavigation() {
  const { t } = useTranslation()
  const { can, activeModules, permissions } = usePermissions()
  const reservations = filterNavigationTabs(reservationTabs, activeModules, permissions)[0]
  const people = filterNavigationTabs(peopleAccessTabs, activeModules, permissions)[0]
  const hasWorkOrders = activeModules.some((module) => module.trim().toLowerCase() === "os") && can("os.work_orders.read")

  return (
    <nav className="people-bottom-nav" aria-label={t("peopleAccess.mobileNavigation")}>
      {can("core.dashboard.read") ? (
        <Link className="touch-target" to="/dashboard"><LayoutDashboard aria-hidden strokeWidth={1.75} /><span>{t("nav.dashboard")}</span></Link>
      ) : null}
      {reservations ? (
        <Link className="touch-target" to={reservations.to}><CalendarCheck aria-hidden strokeWidth={1.75} /><span>{t("nav.reservations")}</span></Link>
      ) : null}
      {hasWorkOrders ? (
        <Link className="touch-target" to="/os"><ClipboardList aria-hidden strokeWidth={1.75} /><span>{t("nav.workOrders")}</span></Link>
      ) : null}
      {people ? (
        <Link className="touch-target" to={people.to} aria-current="page"><Users aria-hidden strokeWidth={1.75} /><span>{t("nav.peopleAccess")}</span></Link>
      ) : null}
      <Link className="touch-target" to="/perfil"><UserRound aria-hidden strokeWidth={1.75} /><span>{t("account.profile")}</span></Link>
    </nav>
  )
}
