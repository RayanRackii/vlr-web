import { Compass } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { AuthLayout } from "@/components/layout/AuthLayout"
import { Button } from "@/components/ui/button"
import { iconProps } from "@/lib/icon"

export function StaffNotFoundPage({ signedIn }: { signedIn: boolean }) {
  const { t } = useTranslation()

  return (
    <AuthLayout title={t("notFound.title")} subtitle={t("notFound.staffDescription")}>
      <div className="space-y-6 rounded-xl border border-border bg-card p-6 text-center">
        <div aria-hidden="true" className="flex flex-col items-center gap-3">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Compass {...iconProps("xl")} />
          </div>
          <span className="text-sm font-medium tracking-widest text-muted-foreground tabular-nums">404</span>
        </div>
        <Button
          className="touch-target min-h-11 w-full whitespace-normal"
          render={<Link to={signedIn ? "/dashboard" : "/login"} />}
        >
          {t(signedIn ? "notFound.dashboard" : "notFound.login")}
        </Button>
      </div>
    </AuthLayout>
  )
}
