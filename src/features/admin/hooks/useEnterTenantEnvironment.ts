import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import {
  clearPlatformTenantExited,
  refreshAuthSession,
  writeActiveTenantLabel,
} from "@/features/admin/hooks/usePlatformTenantSession"
import { enterTenantEnvironment } from "@/features/admin/services/adminTenantsService"

/** Platform-admin "enter the company" flow, shared by the companies list and the edit page. */
export function useEnterTenantEnvironment() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [enteringId, setEnteringId] = useState<string | null>(null)

  async function enter(tenant: { id: string; isActive: boolean }) {
    if (enteringId !== null || !tenant.isActive) {
      return
    }

    setEnteringId(tenant.id)
    try {
      const result = await enterTenantEnvironment(tenant.id)
      clearPlatformTenantExited()
      writeActiveTenantLabel(result.legalName)
      await refreshAuthSession()
      void navigate("/dashboard", { replace: true })
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : t("admin.support.enterFailed")
      toast.error(t("admin.support.enterErrorTitle"), { description: message })
    } finally {
      setEnteringId(null)
    }
  }

  return { enteringId, enter }
}
