import { useTranslation } from "react-i18next"

import { AuthenticatedNotFoundPage } from "@/components/layout/AuthenticatedNotFoundPage"
import { MainLayout } from "@/components/layout/MainLayout"
import { PublicNotFoundPage } from "@/components/layout/PublicNotFoundPage"
import { useAuth } from "@/contexts/AuthContext"

/**
 * Signed-out visitors see a standalone 404 (no admin chrome).
 * Signed-in staff stay in the app shell and see a not-found page.
 */
export function UnknownPathRoute() {
  const { t } = useTranslation()
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </main>
    )
  }

  if (user === null) {
    return <PublicNotFoundPage />
  }

  return (
    <MainLayout>
      <AuthenticatedNotFoundPage />
    </MainLayout>
  )
}
