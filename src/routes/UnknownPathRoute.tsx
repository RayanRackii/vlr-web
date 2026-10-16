import { Navigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { AuthenticatedNotFoundPage } from "@/components/layout/AuthenticatedNotFoundPage"
import { MainLayout } from "@/components/layout/MainLayout"
import { useAuth } from "@/contexts/AuthContext"

/**
 * Public unknown URLs stay on the marketing home.
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
    return <Navigate to="/" replace />
  }

  return (
    <MainLayout>
      <AuthenticatedNotFoundPage />
    </MainLayout>
  )
}
