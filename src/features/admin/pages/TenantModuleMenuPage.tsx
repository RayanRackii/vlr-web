import { useTranslation } from "react-i18next"

import { ModuleMenuItemsManager } from "@/features/admin/components/ModuleMenuItemsManager"

export function TenantModuleMenuPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("admin.moduleMenu.tenantPageTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.moduleMenu.tenantPageDescription")}
        </p>
      </div>
      <ModuleMenuItemsManager />
    </div>
  )
}
