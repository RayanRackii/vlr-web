import { useTranslation } from "react-i18next"

import { RegistrationFieldsManager } from "@/features/admin/components/RegistrationFieldsManager"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

export function TenantRegistrationFieldsPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="mx-auto w-full max-w-xl space-y-4 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("admin.registrationFields.tenantPageTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.registrationFields.tenantPageDescription")}
          </p>
        </div>
      </div>
      <RegistrationFieldsManager
        canWrite={can("core.registration_fields.write")}
      />
    </div>
  )
}
