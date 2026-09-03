import { useMemo } from "react"
import { Menu } from "lucide-react"
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
  const isMobile = viewport === "mobile"

  const brandRow = (
    <div className="flex h-10 items-center gap-2 px-3">
      <TenantLogoMark
        logoSvg={branding?.logoSvg}
        displayName={brandName}
        primaryColor={branding?.primaryColor}
        size="sm"
        className="mx-0 size-6 max-w-6 shrink-0 rounded-md"
      />
      <span className="truncate text-xs font-semibold tracking-tight">
        {brandName}
      </span>
    </div>
  )

  const nav = (
    <nav className="flex flex-col gap-0.5 p-2">
      {navItems.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
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
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })
      )}
    </nav>
  )

  const mockAvatar = (
    <span
      className="size-5 shrink-0 rounded-full bg-muted"
      aria-hidden="true"
    />
  )

  const mockContent = selected ? (
    <div className="space-y-2">
      {kind === "catalog" ? (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="space-y-1.5 rounded-lg border border-dashed border-border bg-card p-2"
              >
                <div className="h-7 rounded-md bg-muted" />
                <div className="h-1.5 w-2/3 rounded-full bg-muted" />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("admin.moduleMenu.previewCatalogPlaceholder")}
          </p>
        </>
      ) : null}
      {kind === "orders" ? (
        <>
          <div className="space-y-1.5">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="flex h-7 items-center gap-2 rounded-md border border-dashed border-border bg-card px-2"
              >
                <div className="h-1.5 w-1/2 rounded-full bg-muted" />
                <div className="ml-auto h-1.5 w-6 rounded-full bg-muted" />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("admin.moduleMenu.previewOrdersPlaceholder")}
          </p>
        </>
      ) : null}
      {kind === "agenda" ? (
        <>
          <div className="space-y-1.5 rounded-lg border border-dashed border-border bg-card p-2.5">
            <div className="h-1.5 w-1/3 rounded-full bg-muted" />
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div key={index} className="h-6 rounded-md bg-muted" />
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("admin.moduleMenu.previewAgendaPlaceholder")}
          </p>
        </>
      ) : null}
    </div>
  ) : (
    <p className="text-xs text-muted-foreground">
      {t("admin.moduleMenu.previewEmpty")}
    </p>
  )

  return (
    <section className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {t("admin.moduleMenu.previewCaption")}
      </p>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-background shadow-sm",
          isMobile ? "mx-auto w-full max-w-[19rem]" : "w-full",
        )}
        style={style}
      >
        {isMobile ? (
          <div className="flex flex-col">
            <div className="flex h-10 items-center gap-2 border-b border-border px-3">
              <Menu
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {selected?.label ?? brandName}
              </span>
              {mockAvatar}
            </div>
            <div className="border-b border-border bg-card">
              {brandRow}
              {nav}
            </div>
            <div className="bg-muted/30 p-3">{mockContent}</div>
          </div>
        ) : (
          <div className="grid min-h-[15rem] grid-cols-[10.5rem_1fr]">
            <aside className="flex flex-col border-r border-border bg-card">
              {brandRow}
              <Separator />
              {nav}
            </aside>
            <div className="flex min-w-0 flex-col">
              <div className="flex h-9 items-center justify-between gap-2 border-b border-border px-3">
                <span className="truncate text-xs font-medium">
                  {selected?.label ?? brandName}
                </span>
                {mockAvatar}
              </div>
              <div className="flex-1 bg-muted/30 p-3">{mockContent}</div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
