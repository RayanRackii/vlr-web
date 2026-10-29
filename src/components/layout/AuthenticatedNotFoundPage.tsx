import { Compass } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { iconProps } from "@/lib/icon"

export function AuthenticatedNotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="mx-auto my-8 flex w-full max-w-lg flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-12 text-center sm:my-12">
      <div aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass {...iconProps("xl")} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("notFound.title")}
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t("notFound.description")}
      </p>
      <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        <Button className="touch-target min-h-11 whitespace-normal" render={<Link to="/dashboard" />}>{t("notFound.home")}</Button>
        <Button type="button" variant="outline" className="touch-target min-h-11 whitespace-normal" onClick={() => {
          if (window.history.length > 1) navigate(-1)
          else void navigate("/dashboard", { replace: true })
        }}>{t("common.back")}</Button>
      </div>
    </div>
  )
}
