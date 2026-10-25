import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"

import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

/** Portal-only fallback; it never redirects into the staff application. */
export function PortalNotFoundRoute() {
  const { t } = useTranslation()
  const { subdomain } = useParams<{ subdomain: string }>()
  const home = subdomain ? tenantPortalPath(subdomain) : "/"

  return (
    <section className="mx-auto flex min-h-64 w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("notFound.description")}
      </p>
      <Link className="text-sm font-medium text-primary underline" to={home}>
        {t("notFound.home")}
      </Link>
    </section>
  )
}
