import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  useAppNavigationSections,
  type AppNavigationItem,
} from "@/components/layout/navigation"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

type SidebarProps = {
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
  touchTargets?: boolean
  className?: string
}

const NAV_ICON_CLASS = "size-[1.125rem] shrink-0"

/** Soft-tinted active fill + rested/hover treatment, shared by leaf and child rows. */
function rowClassName(isActive: boolean, touchTargets: boolean | undefined) {
  return cn(
    "group/nav relative flex items-center gap-2.5 rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    touchTargets ? "min-h-11 py-2" : "min-h-9 py-1.5",
    isActive
      ? "bg-primary/10 text-primary dark:bg-primary/15"
      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  )
}

/** The left edge pill that marks the active row. */
function ActiveIndicator({ show }: { show: boolean }) {
  if (!show) {
    return null
  }
  return (
    <span
      aria-hidden="true"
      className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-primary"
    />
  )
}

function NavigationLink({
  item,
  onNavigate,
  collapsed,
  touchTargets,
}: {
  item: AppNavigationItem
  onNavigate?: () => void
  collapsed?: boolean
  touchTargets?: boolean
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const Icon = item.icon
  const children = item.children
  const hasChildren = children !== undefined && children.length > 0
  const label = t(item.labelKey)
  const isSectionActive =
    hasChildren &&
    children.some(
      (child) =>
        location.pathname === child.to ||
        location.pathname.startsWith(`${child.to}/`),
    )

  // Collapsed rail: groups become an on-demand flyout; leaves are icon buttons.
  if (collapsed) {
    if (hasChildren && children !== undefined) {
      return (
        <Popover open={flyoutOpen} onOpenChange={setFlyoutOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={label}
                title={label}
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  isSectionActive
                    ? "bg-primary/10 text-primary dark:bg-primary/15"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              />
            }
          >
            <Icon className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-56 gap-0.5 p-1.5"
          >
            <p className="px-2 pb-1 pt-1 text-xs font-semibold text-muted-foreground">
              {label}
            </p>
            {children.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                end={child.to === item.to}
                onClick={() => {
                  setFlyoutOpen(false)
                  onNavigate?.()
                }}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-9 items-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors duration-150 ease-out motion-reduce:transition-none",
                    isActive
                      ? "bg-primary/10 text-primary dark:bg-primary/15"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )
                }
              >
                {t(child.labelKey)}
              </NavLink>
            ))}
          </PopoverContent>
        </Popover>
      )
    }

    return (
      <NavLink
        to={item.to}
        onClick={onNavigate}
        title={label}
        aria-label={label}
        className={({ isActive }) =>
          cn(
            "flex size-10 items-center justify-center rounded-lg outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            isActive
              ? "bg-primary/10 text-primary dark:bg-primary/15"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )
        }
      >
        <Icon className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
      </NavLink>
    )
  }

  // Expanded group: muted header + indented, left-bordered child list.
  if (hasChildren && children !== undefined) {
    return (
      <div className="space-y-0.5">
        <div
          className={cn(
            "flex min-h-9 items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium",
            isSectionActive ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <Icon className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
          <span className="truncate">{label}</span>
        </div>

        <div className="ml-[1.3125rem] space-y-0.5 border-l border-sidebar-border pl-3">
          {children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.to === item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  touchTargets ? "min-h-11 py-2" : "min-h-8 py-1.5",
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/15"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <ActiveIndicator show={isActive} />
                  <span className="truncate">{t(child.labelKey)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    )
  }

  // Expanded leaf.
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) => rowClassName(isActive, touchTargets)}
    >
      {({ isActive }) => (
        <>
          <ActiveIndicator show={isActive} />
          <Icon className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function SidebarNavigationSkeleton({
  label,
  collapsed,
}: {
  label: string
  collapsed?: boolean
}) {
  return (
    <div className="flex flex-col gap-5" aria-label={label} role="status">
      {[2, 4].map((itemCount, sectionIndex) => (
        <div
          key={itemCount}
          className={cn("flex flex-col gap-2", collapsed ? "items-center" : "px-3")}
        >
          {!collapsed ? (
            <Skeleton
              className={cn("h-2.5", sectionIndex === 0 ? "w-24" : "w-16")}
            />
          ) : null}
          {Array.from({ length: itemCount }, (_, itemIndex) => (
            <div
              key={itemIndex}
              className={cn(
                "flex items-center gap-2.5",
                collapsed ? "h-10 justify-center" : "h-9",
              )}
              aria-hidden
            >
              <Skeleton className="size-[1.125rem] shrink-0 rounded-md" />
              {!collapsed ? (
                <Skeleton
                  className={cn("h-3", itemIndex % 2 === 0 ? "w-28" : "w-20")}
                />
              ) : null}
            </div>
          ))}
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function Sidebar({
  onNavigate,
  collapsed,
  onToggleCollapsed,
  touchTargets,
  className,
}: SidebarProps) {
  const { t } = useTranslation()
  const { sections: navigationSections, isLoading } = useAppNavigationSections()

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div
        className={cn(
          "flex h-14 items-center",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        {!collapsed ? (
          <span className="truncate text-sm font-semibold tracking-tight">
            {t("app.name")}
          </span>
        ) : null}

        {onToggleCollapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t("nav.expandMenu") : t("nav.collapseMenu")}
            title={collapsed ? t("nav.expandMenu") : t("nav.collapseMenu")}
            className="text-muted-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen strokeWidth={ICON_STROKE_WIDTH} />
            ) : (
              <PanelLeftClose strokeWidth={ICON_STROKE_WIDTH} />
            )}
          </Button>
        ) : null}
      </div>

      <Separator />

      <nav
        className={cn(
          "flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden py-3",
          collapsed ? "items-center px-2" : "px-3",
        )}
        aria-busy={isLoading}
      >
        {navigationSections.map((section, sectionIndex) => (
          <div
            key={section.titleKey}
            className={cn(
              "flex w-full flex-col gap-0.5",
              collapsed && "items-center gap-1",
            )}
          >
            {collapsed ? (
              sectionIndex > 0 ? <Separator className="my-1 w-8" /> : null
            ) : (
              <p className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {t(section.titleKey)}
              </p>
            )}
            {section.items.map((item) => (
              <NavigationLink
                key={`${section.titleKey}-${item.to}`}
                item={item}
                onNavigate={onNavigate}
                collapsed={collapsed}
                touchTargets={touchTargets}
              />
            ))}
          </div>
        ))}
        {isLoading ? (
          <SidebarNavigationSkeleton
            label={t("nav.loading")}
            collapsed={collapsed}
          />
        ) : null}
      </nav>
    </div>
  )
}
