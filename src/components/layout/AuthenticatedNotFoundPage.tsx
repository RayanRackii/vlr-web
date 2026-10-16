import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

export function AuthenticatedNotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("notFound.title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("notFound.description")}
      </p>
      <Link
        to="/dashboard"
        className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("notFound.home")}
      </Link>
    </div>
  )
}
