import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

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
      <Button size="sm" className="min-h-11" render={<Link to="/" />}>
        {t("notFound.home")}
      </Button>
    </main>
  )
}
