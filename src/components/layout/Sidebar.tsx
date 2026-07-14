import { NavLink, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Separator } from "@/components/ui/separator"
import {
  useAppNavigationItems,
  type AppNavigationItem,
} from "@/components/layout/navigation"
import { cn } from "@/lib/utils"

type SidebarProps = {
  onNavigate?: () => void
  className?: string
}

function NavigationLink({
  item,
  onNavigate,
}: {
  item: AppNavigationItem
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const Icon = item.icon
  const children = item.children
  const hasChildren = children !== undefined && children.length > 0
  const isSectionActive =
    hasChildren &&
    children.some(
      (child) =>
        location.pathname === child.to ||
        location.pathname.startsWith(`${child.to}/`),
    )

  if (hasChildren && children !== undefined) {
    return (
      <div className="space-y-1">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            isSectionActive
              ? "text-foreground"
              : "text-muted-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span>{t(item.labelKey)}</span>
        </div>

        <div className="ml-4 space-y-1 border-l border-border pl-3">
          {children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.to === item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              {t(child.labelKey)}
            </NavLink>
          ))}
        </div>
      </div>
    )
  }

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{t(item.labelKey)}</span>
    </NavLink>
  )
}

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const { t } = useTranslation()
  const navigationItems = useAppNavigationItems()

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex h-14 items-center px-4">
        <span className="text-sm font-semibold tracking-tight">
          {t("app.name")}
        </span>
      </div>

      <Separator />

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navigationItems.map((item) => (
          <NavigationLink key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
    </div>
  )
}
