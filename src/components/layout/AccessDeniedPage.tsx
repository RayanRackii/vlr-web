import { useTranslation } from "react-i18next"

import { useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function AccessDeniedPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="mx-auto w-full max-w-lg space-y-2 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("accessDenied.title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("accessDenied.description")}
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          if (location.key !== "default") {
            void navigate(-1)
          } else {
            void navigate("/", { replace: true })
          }
        }}
      >
        {t("common.back")}
      </Button>
    </div>
  )
}
