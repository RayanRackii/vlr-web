import { Compass } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { AuthLayout } from "@/components/layout/AuthLayout"
import { Button } from "@/components/ui/button"

export function StaffNotFoundPage({ signedIn }: { signedIn: boolean }) {
  const { t } = useTranslation()

  return (
    <AuthLayout title={t("notFound.title")} subtitle={t("notFound.staffDescription")}>
      <div className="space-y-6">
        <div aria-hidden="true" className="flex items-center gap-3 text-muted-foreground">
          <Compass className="size-8 text-primary" />
          <span className="text-4xl font-semibold tabular-nums">404</span>
        </div>
        <Button
          className="min-h-11 w-full"
          render={<Link to={signedIn ? "/dashboard" : "/login"} />}
        >
          {t(signedIn ? "notFound.dashboard" : "notFound.login")}
        </Button>
      </div>
    </AuthLayout>
  )
}
