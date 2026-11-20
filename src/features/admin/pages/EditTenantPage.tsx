import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"

import { useBreadcrumbTitle } from "@/components/layout/useBreadcrumbTitle"
import { Page } from "@/components/layout/Page"
import { TenantEditForm } from "@/features/admin/components/TenantEditForm"
import {
  tenantHasLegacyMaintenance,
  type TenantAdmin,
} from "@/features/admin/schemas/adminTenantSchemas"
import { getAdminTenant } from "@/features/admin/services/adminTenantsService"
import { isAxiosError } from "@/lib/api"

/** Platform-admin company edit page. Rendered inside the admin shell (sidebar and breadcrumb). */
export function EditTenantPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<TenantAdmin | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  const tenantId = id ?? ""
  useBreadcrumbTitle(tenant?.legalName)

  const retry = useCallback(() => {
    setAttempt((value) => value + 1)
  }, [])

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
        const loaded = await getAdminTenant(tenantId)
        if (!cancelled) {
          setTenant(loaded)
        }
      } catch (error: unknown) {
        if (cancelled) {
          return
        }

        console.error("EditTenantPage loadTenant failed", error)

        if (isAxiosError(error) && error.response?.status === 404) {
          setLoadError(t("admin.edit.errors.notFound"))
        } else {
          setLoadError(
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : t("admin.edit.errors.loadFailed"),
          )
        }
        setTenant(null)
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
  }, [attempt, t, tenantId])

  if (isLoading) {
    return <Page header={{ title: t("admin.edit.title") }} state="loading">{null}</Page>
  }

  if (loadError || !tenant) {
    return (
      <Page
        header={{
          title: t("admin.edit.title"),
        }}
        state="error"
        error={loadError ?? t("admin.edit.errors.loadFailed")}
        onRetry={retry}
      >
        {null}
      </Page>
    )
  }

  return (
    <TenantEditForm
      // A reload (retry) or a different company starts from a clean form.
      key={`${tenant.id}-${attempt}`}
      tenant={tenant}
      hasLegacyMaintenance={tenantHasLegacyMaintenance(tenant)}
    />
  )
}
