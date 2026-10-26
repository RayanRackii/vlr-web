import { CompassIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

type PortalNotFoundRouteProps = {
  /** Set when the tenant slug itself does not exist, so "home" leaves the dead subdomain instead of looping back to it. */
  tenantExists?: boolean
}

/** Portal-only fallback; it never redirects into the staff application. */
export function PortalNotFoundRoute({
  tenantExists = true,
}: PortalNotFoundRouteProps) {
  const { t } = useTranslation()
  const { subdomain } = useParams<{ subdomain: string }>()
  const home = subdomain && tenantExists ? tenantPortalPath(subdomain) : "/"

  return (
    <section className="mx-auto flex min-h-64 w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CompassIcon className="size-6" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-foreground">{t("notFound.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("notFound.description")}</p>
      <Button size="sm" render={<Link to={home} />}>
        {t("notFound.home")}
      </Button>
    </section>
  )
}
