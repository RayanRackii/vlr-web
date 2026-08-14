import type { LucideIcon } from "lucide-react"
import { CalendarDays } from "lucide-react"
import { NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { TenantLogoMark } from "@/features/tenantPortal/components/TenantLogoMark"
import { Separator } from "@/components/ui/separator"
import { ROLVIX_PRIMARY_COLOR } from "@/lib/brandColors"
import { cn } from "@/lib/utils"

export type CustomerNavItem = {
  id: string
  label: string
  to: string
  icon: LucideIcon
}

type CustomerSidebarProps = {
  brandLabel: string
  logoSvg?: string | null
  primaryColor?: string | null
  items: readonly CustomerNavItem[]
  onNavigate?: () => void
  className?: string
}

export function CustomerSidebar({
  brandLabel,
  logoSvg,
  primaryColor,
  items,
  onNavigate,
  className,
}: CustomerSidebarProps) {
  const { t } = useTranslation()
  const primary = primaryColor ?? ROLVIX_PRIMARY_COLOR

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex h-14 items-center gap-2 px-4">
        <TenantLogoMark
          logoSvg={logoSvg}
          displayName={brandLabel}
          primaryColor={primaryColor}
          size="sm"
          className="mx-0 shrink-0"
        />
        <span className="truncate text-sm font-semibold tracking-tight">
          {brandLabel}
        </span>
      </div>

      <Separator />

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            {t("tenantPortal.menu.empty")}
          </p>
        ) : (
          items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.id}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
                style={({ isActive }) =>
                  isActive ? { backgroundColor: primary } : undefined
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })
        )}
      </nav>
    </div>
  )
}

/** Icon for a platform module key (B2C surfaces). */
export function iconForModule(moduleName: string): LucideIcon {
  switch (moduleName.toLowerCase()) {
    case "rentals":
      return CalendarDays
    default:
      return CalendarDays
  }
}
