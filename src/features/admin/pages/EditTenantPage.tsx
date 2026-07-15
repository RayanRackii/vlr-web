import { useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import { TenantEditForm } from "@/features/admin/components/TenantEditForm"
import {
  tenantAdminToFormValues,
  type TenantOnboardingFormValues,
} from "@/features/admin/schemas/adminTenantSchemas"
import { getAdminTenant } from "@/features/admin/services/adminTenantsService"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isAxiosError } from "@/lib/api"

function EditTenantFormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  )
}

export function EditTenantPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [initialValues, setInitialValues] =
    useState<TenantOnboardingFormValues | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const tenantId = id ?? ""

  useEffect(() => {
    if (!tenantId) {
      setLoadError(t("admin.edit.errors.invalidId"))
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadTenant() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const tenant = await getAdminTenant(tenantId)

        if (cancelled) {
          return
        }

        setInitialValues(tenantAdminToFormValues(tenant))
      } catch (error: unknown) {
        if (cancelled) {
          return
        }

        console.error("EditTenantPage loadTenant failed", error)

        if (isAxiosError(error) && error.response?.status === 404) {
          setLoadError(t("admin.edit.errors.notFound"))
        } else {
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : t("admin.edit.errors.loadFailed")

          setLoadError(message)
        }

        setInitialValues(null)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadTenant()

    return () => {
      cancelled = true
    }
  }, [t, tenantId])

  const formKey = useMemo(() => {
    if (!initialValues) {
      return "loading"
    }

    return `${tenantId}-${initialValues.subdomain}`
  }, [initialValues, tenantId])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigate("/admin/dashboard")
            }}
          >
            <ArrowLeft className="size-4" />
            {t("admin.wizard.actions.backToDashboard")}
          </Button>

          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        {isLoading ? <EditTenantFormSkeleton /> : null}

        {!isLoading && loadError ? (
          <div className="mx-auto w-full max-w-xl space-y-4">
            <p className="text-sm text-destructive" role="alert">
              {loadError}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigate("/admin/dashboard")
              }}
            >
              {t("admin.wizard.actions.backToDashboard")}
            </Button>
          </div>
        ) : null}

        {!isLoading && !loadError && initialValues ? (
          <TenantEditForm key={formKey} tenantId={tenantId} initialValues={initialValues} />
        ) : null}
      </main>
    </div>
  )
}
