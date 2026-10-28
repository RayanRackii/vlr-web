import { useTranslation } from "react-i18next"

import { RegistrationFieldsManager } from "@/features/admin/components/RegistrationFieldsManager"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

export function TenantRegistrationFieldsPage({
  embedded = false,
}: { embedded?: boolean }) {
  const { t } = useTranslation()
  const { can } = usePermissions()

  return (
    <div className={`registration-fields-page mx-auto w-full space-y-6${embedded ? "" : " max-w-6xl"}`}>
      {embedded ? null : (
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
      )}
      <RegistrationFieldsManager
        canWrite={can("core.registration_fields.write")}
      />
    </div>
  )
}
