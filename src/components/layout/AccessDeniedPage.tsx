import { useTranslation } from "react-i18next"

export function AccessDeniedPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-lg space-y-2 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("accessDenied.title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("accessDenied.description")}
      </p>
    </div>
  )
}
