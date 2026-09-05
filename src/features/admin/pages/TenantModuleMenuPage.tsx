import { useState } from "react"
import { useTranslation } from "react-i18next"

import { ModuleMenuItemsManager } from "@/features/admin/components/ModuleMenuItemsManager"
import { PortalModuleDiscovery } from "@/features/admin/components/PortalModuleDiscovery"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { cn } from "@/lib/utils"

type ModuleMenuTab = "configuration" | "explore"

export function TenantModuleMenuPage() {
  const { t } = useTranslation()
  const { can, activeModules } = usePermissions()
  const [tab, setTab] = useState<ModuleMenuTab>("configuration")

  const tabItems: { id: ModuleMenuTab; labelKey: string }[] = [
    {
      id: "configuration",
      labelKey: "admin.moduleMenu.tabs.configuration",
    },
    {
      id: "explore",
      labelKey: "admin.moduleMenu.tabs.explore",
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="mx-auto w-full max-w-xl space-y-4 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("admin.moduleMenu.tenantPageTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.moduleMenu.tenantPageDescription")}
          </p>
        </div>

        <div className="border-b border-border">
          <nav
            className="-mb-px flex justify-center gap-6 overflow-x-auto sm:gap-8"
            aria-label={t("admin.moduleMenu.tenantPageTitle")}
          >
            {tabItems.map((item) => {
              const isActive = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id)
                  }}
                  className={cn(
                    "border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {t(item.labelKey)}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      <div
        className={cn(tab !== "configuration" && "hidden")}
        aria-hidden={tab !== "configuration"}
      >
        <ModuleMenuItemsManager
          activeModules={activeModules}
          canWrite={can("core.module_menu.write")}
        />
      </div>

      <div
        className={cn(tab !== "explore" && "hidden")}
        aria-hidden={tab !== "explore"}
      >
        <PortalModuleDiscovery />
      </div>
    </div>
  )
}
