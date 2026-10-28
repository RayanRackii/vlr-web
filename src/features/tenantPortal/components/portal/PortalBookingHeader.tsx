import { useTranslation } from "react-i18next"
import { getCustomerLabel } from "@/features/tenantPortal/services/tenantPortalService"

type Props = { tenantName?: string; title?: string }

export function PortalBookingHeader({ tenantName, title }: Props) {
  const { t } = useTranslation()
  const name = getCustomerLabel()?.split(" ")[0]
  return (
    <header className="portal-booking-header">
      <p className="portal-eyebrow">{name ? t("tenantPortal.redesign.greetingName", { name }) : t("tenantPortal.redesign.greeting")}</p>
      <h1>{title ?? t("tenantPortal.redesign.title")}</h1>
      <p className="text-muted-foreground">{tenantName ? t("tenantPortal.redesign.subtitleTenant", { tenant: tenantName }) : t("tenantPortal.redesign.subtitle")}</p>
    </header>
  )
}
