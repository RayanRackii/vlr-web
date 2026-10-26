import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

/** Standalone 404 for signed-out visitors; no admin/app chrome. */
export function PublicNotFoundPage() {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("notFound.title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("notFound.description")}
      </p>
      <Link
        to="/"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("notFound.home")}
      </Link>
    </main>
  )
}
