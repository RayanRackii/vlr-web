import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"

export function AuthenticatedNotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("notFound.title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("notFound.description")}
      </p>
      <div className="flex justify-center gap-3">
        <Button type="button" variant="outline" onClick={() => {
          if (window.history.length > 1) navigate(-1)
          else void navigate("/dashboard", { replace: true })
        }}>{t("common.back")}</Button>
        <Link to="/dashboard" className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline">{t("notFound.home")}</Link>
      </div>
    </div>
  )
}
