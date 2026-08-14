import { NavLink, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Separator } from "@/components/ui/separator"
import {
  useAppNavigationSections,
  type AppNavigationItem,
} from "@/components/layout/navigation"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

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

function SidebarNavigationSkeleton({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col gap-5"
      aria-label={label}
      role="status"
    >
      {[2, 4].map((itemCount, sectionIndex) => (
        <div key={itemCount} className="flex flex-col gap-2 px-3">
          <Skeleton
            className={cn("h-2.5", sectionIndex === 0 ? "w-24" : "w-16")}
          />
          {Array.from({ length: itemCount }, (_, itemIndex) => (
            <div
              key={itemIndex}
              className="flex h-8 items-center gap-2"
              aria-hidden
            >
              <Skeleton className="size-4 shrink-0 rounded-sm" />
              <Skeleton
                className={cn(
                  "h-3",
                  itemIndex % 2 === 0 ? "w-28" : "w-20",
                )}
              />
            </div>
          ))}
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const { t } = useTranslation()
  const { sections: navigationSections, isLoading } =
    useAppNavigationSections()

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex h-14 items-center px-4">
        <span className="text-sm font-semibold tracking-tight">
          {t("app.name")}
        </span>
      </div>

      <Separator />

      <nav
        className="flex flex-1 flex-col gap-5 overflow-y-auto p-3"
        aria-busy={isLoading}
      >
        {navigationSections.map((section) => (
          <div key={section.titleKey} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t(section.titleKey)}
            </p>
            {section.items.map((item) => (
              <NavigationLink
                key={`${section.titleKey}-${item.to}`}
                item={item}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
        {isLoading ? (
          <SidebarNavigationSkeleton label={t("nav.loading")} />
        ) : null}
      </nav>
    </div>
  )
}
