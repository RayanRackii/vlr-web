import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Separator } from "@/components/ui/separator"
import {
  buildCustomerNavItems,
  getVisiblePortalMenuItems,
} from "@/features/catalog/customerNav"
import { TenantLogoMark } from "@/features/tenantPortal/components/TenantLogoMark"
import type {
  ModuleMenuItem,
  TenantBranding,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import { useTenantThemeCssVars } from "@/lib/useTenantTheme"
import { cn } from "@/lib/utils"

export type PortalMenuPreviewProps = {
  branding?: TenantBranding | null
  items: ModuleMenuItem[]
  activeModules: readonly string[]
  subdomain: string
  activeNavId: string | null
  onActiveNavIdChange: (id: string) => void
  viewport?: "desktop" | "mobile"
}

function mockKind(path: string): "agenda" | "catalog" | "orders" {
  if (path.includes("pedidos")) {
    return "orders"
  }
  if (path.includes("catalogo")) {
    return "catalog"
  }
  return "agenda"
}

export function PortalMenuPreview({
  branding,
  items,
  activeModules,
  subdomain,
  activeNavId,
  onActiveNavIdChange,
  viewport = "desktop",
}: PortalMenuPreviewProps) {
  const { t } = useTranslation()
  const { style } = useTenantThemeCssVars(
    branding?.primaryColor,
    branding?.accentColor,
  )
  const brandName =
    branding?.displayName?.trim() || t("admin.moduleMenu.previewFallbackName")

  const navItems = useMemo(() => {
    const visible = getVisiblePortalMenuItems(items, activeModules)
    return buildCustomerNavItems(subdomain, visible, t)
  }, [activeModules, items, subdomain, t])

  const selected =
    navItems.find((item) => item.id === activeNavId) ?? navItems[0] ?? null
  const kind = selected ? mockKind(selected.to) : "agenda"

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("admin.moduleMenu.previewCaption")}
      </p>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-background shadow-sm",
          viewport === "mobile" ? "mx-auto max-w-[22rem]" : "w-full",
        )}
        style={style}
      >
        <div
          className={cn(
            "grid min-h-[22rem]",
            viewport === "mobile" ? "grid-cols-1" : "grid-cols-[13rem_1fr]",
          )}
        >
          <aside className="flex flex-col border-b border-border bg-card sm:border-b-0 sm:border-r">
            <div className="flex h-12 items-center gap-2 px-3">
              <TenantLogoMark
                logoSvg={branding?.logoSvg}
                displayName={brandName}
                primaryColor={branding?.primaryColor}
                size="sm"
                className="mx-0 shrink-0"
              />
              <span className="truncate text-sm font-semibold tracking-tight">
                {brandName}
              </span>
            </div>
            <Separator />
            <nav className="flex flex-1 flex-col gap-1 p-2">
              {navItems.length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">
                  {t("admin.moduleMenu.previewEmpty")}
                </p>
              ) : (
                navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = selected?.id === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={item.label}
                      onClick={() => {
                        onActiveNavIdChange(item.id)
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })
              )}
            </nav>
          </aside>
          <div className="bg-muted/30 p-4">
            {selected ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">{selected.label}</p>
                {kind === "catalog" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-20 rounded-lg border border-dashed border-border bg-card" />
                    <div className="h-20 rounded-lg border border-dashed border-border bg-card" />
                    <p className="col-span-2 text-xs text-muted-foreground">
                      {t("admin.moduleMenu.previewCatalogPlaceholder")}
                    </p>
                  </div>
                ) : null}
                {kind === "orders" ? (
                  <div className="space-y-2">
                    <div className="h-8 rounded-md border border-dashed border-border bg-card" />
                    <div className="h-8 rounded-md border border-dashed border-border bg-card" />
                    <p className="text-xs text-muted-foreground">
                      {t("admin.moduleMenu.previewOrdersPlaceholder")}
                    </p>
                  </div>
                ) : null}
                {kind === "agenda" ? (
                  <div className="space-y-2">
                    <div className="h-28 rounded-lg border border-dashed border-border bg-card" />
                    <p className="text-xs text-muted-foreground">
                      {t("admin.moduleMenu.previewAgendaPlaceholder")}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("admin.moduleMenu.previewEmpty")}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
