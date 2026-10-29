import { Fragment, useId, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronRight, Info, PanelLeftClose, PanelLeftOpen } from "lucide-react"

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
  type AppNavigationSection,
} from "@/components/layout/navigation"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { matchNavigationPath, type NavigationMatch } from "./navigationMatching"
import { matchModuleIntro, moduleIntroPath, type ModuleIntroKey } from "./navigationIntros"

type SidebarProps = {
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
  touchTargets?: boolean
  className?: string
}

const NAV_ICON_CLASS = "size-5 shrink-0"

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
  match,
  activeIntroKey,
}: {
  item: AppNavigationItem
  onNavigate?: () => void
  collapsed?: boolean
  touchTargets?: boolean
  match?: NavigationMatch
  activeIntroKey?: ModuleIntroKey
}) {
  const { t } = useTranslation()
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const childrenId = useId()
  const Icon = item.icon
  const children = item.children
  const hasChildren = children !== undefined && children.length > 0
  const label = t(item.labelKey)
  const tooltip = item.labelKey === "nav.pmoc" ? t("nav.pmocTooltip") || label : label
  const isIntroActive = item.introKey !== undefined && activeIntroKey === item.introKey
  const isActive = match?.item === item || isIntroActive
  const isSectionActive = hasChildren && isActive

  // Collapsed rail: groups become an on-demand flyout; leaves are icon buttons.
  if (collapsed) {
    if (hasChildren && children !== undefined) {
      return (
        <Popover open={flyoutOpen} onOpenChange={setFlyoutOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={t(flyoutOpen ? "moduleIntro.collapse" : "moduleIntro.expand", { module: label })}
                title={tooltip}
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
            {item.introKey ? (
              <Link
                to={moduleIntroPath(item.introKey)}
                aria-label={t("moduleIntro.open", { module: label })}
                aria-current={isIntroActive ? "page" : undefined}
                className={rowClassName(isIntroActive, touchTargets)}
                onClick={() => { setFlyoutOpen(false); onNavigate?.() }}
              >
                {label}
              </Link>
            ) : <p className="px-2 pb-1 pt-1 text-xs font-semibold text-muted-foreground">{label}</p>}
            {children.map((child) => (
              <Link
                key={child.to}
                to={child.to}
                aria-current={match?.child === child ? "page" : undefined}
                onClick={() => {
                  setFlyoutOpen(false)
                  onNavigate?.()
                }}
                className={
                  cn(
                    "flex min-h-9 items-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors duration-150 ease-out motion-reduce:transition-none",
                    match?.child === child
                      ? "bg-primary/10 text-primary dark:bg-primary/15"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )
                }
              >
                {t(child.labelKey)}
              </Link>
            ))}
          </PopoverContent>
        </Popover>
      )
    }

    return (
      <Link
        to={item.to}
        aria-current={isActive ? "page" : undefined}
        onClick={onNavigate}
        title={tooltip}
        aria-label={label}
        className={
          cn(
            "flex size-10 items-center justify-center rounded-lg outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            isActive
              ? "bg-primary/10 text-primary dark:bg-primary/15"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )
        }
      >
        <Icon className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
      </Link>
    )
  }

  // Expanded group: muted header + indented, left-bordered child list.
  if (hasChildren && children !== undefined) {
    return (
      <div className="space-y-0.5">
        <div
          className={cn("flex items-center rounded-lg text-sm font-medium", isIntroActive ? "bg-primary/10 text-primary" : isSectionActive ? "text-foreground" : "text-muted-foreground")}
        >
          {item.introKey ? (
            <Link
              to={moduleIntroPath(item.introKey)}
              title={tooltip}
              aria-label={t("moduleIntro.open", { module: label })}
              aria-current={isIntroActive ? "page" : undefined}
              onClick={onNavigate}
              className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 outline-none hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring", touchTargets ? "min-h-11" : "min-h-9", isSectionActive && !isIntroActive && "text-foreground")}
            >
              <Icon className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Link>
          ) : (
            <span title={tooltip} className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5">
              <Icon className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </span>
          )}
          <button
            type="button"
            aria-label={t(expanded ? "moduleIntro.collapse" : "moduleIntro.expand", { module: label })}
            aria-expanded={expanded}
            aria-controls={childrenId}
            onClick={() => setExpanded((value) => !value)}
            className={cn("flex shrink-0 items-center justify-center rounded-lg outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring", touchTargets ? "size-11" : "size-9")}
          >
            {expanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
          </button>
        </div>

        <div id={childrenId} hidden={!expanded} className="ml-[1.3125rem] space-y-0.5 border-l border-sidebar-border pl-3">
          {children.map((child) => (
            <Link
              key={child.to}
              to={child.to}
              aria-current={match?.child === child ? "page" : undefined}
              onClick={onNavigate}
              className={
                cn(
                  "relative flex items-center rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  touchTargets ? "min-h-11 py-2" : "min-h-8 py-1.5",
                  match?.child === child
                    ? "bg-primary/10 text-primary dark:bg-primary/15"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )
              }
            >
              <ActiveIndicator show={match?.child === child} />
              <span className="truncate">{t(child.labelKey)}</span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // Expanded leaf.
  return (
    <Link
      to={item.to}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
      className={rowClassName(isActive, touchTargets)}
    >
      <ActiveIndicator show={isActive} />
      <Icon className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function NavigationSection({
  section, collapsed, touchTargets, onNavigate, match, activeIntroKey,
}: {
  section: AppNavigationSection
  collapsed?: boolean
  touchTargets?: boolean
  onNavigate?: () => void
  match?: NavigationMatch
  activeIntroKey?: ModuleIntroKey
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(true)
  const itemsId = useId()
  const label = t(section.titleKey)
  const isIntroActive = section.introKey !== undefined && section.introKey === activeIntroKey
  const isGroupActive = isIntroActive || section.items.some((item) => item.introKey !== undefined && item.introKey === activeIntroKey)

  return (
    <div className={cn("flex w-full flex-col gap-0.5", collapsed && "items-center gap-1")}>
      <div className={cn("flex items-center", collapsed && "justify-center", isGroupActive ? "text-primary" : "text-muted-foreground/80")}>
        {section.introKey ? (
          <Link
            to={moduleIntroPath(section.introKey)}
            aria-label={t("moduleIntro.open", { module: label })}
            aria-current={isIntroActive ? "page" : undefined}
            onClick={onNavigate}
            className={cn("flex min-w-0 items-center rounded-lg outline-none hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring", collapsed ? "size-10 justify-center" : "flex-1 px-3 text-[0.6875rem] font-semibold uppercase tracking-wider", !collapsed && (touchTargets ? "min-h-11" : "min-h-9"), isIntroActive && "bg-primary/10")}
          >
            {collapsed ? <Info className="size-4" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" /> : <span className="truncate">{label}</span>}
          </Link>
        ) : !collapsed && <p className="flex-1 px-3 text-[0.6875rem] font-semibold uppercase tracking-wider">{label}</p>}
        {!collapsed && (
          <button
            type="button"
            aria-label={t(expanded ? "moduleIntro.collapse" : "moduleIntro.expand", { module: label })}
            aria-expanded={expanded}
            aria-controls={itemsId}
            onClick={() => setExpanded((value) => !value)}
            className={cn("flex shrink-0 items-center justify-center rounded-lg outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring", touchTargets ? "size-11" : "size-9")}
          >
            {expanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      <div id={itemsId} hidden={!collapsed && !expanded} className={cn("space-y-0.5", collapsed && "flex flex-col items-center gap-1")}>
        {section.items.map((item) => (
          <NavigationLink key={item.to} item={item} match={match} activeIntroKey={activeIntroKey} onNavigate={onNavigate} collapsed={collapsed} touchTargets={touchTargets} />
        ))}
      </div>
    </div>
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
              <Skeleton className="size-5 shrink-0 rounded-md" />
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
  const { pathname } = useLocation()
  const match = matchNavigationPath(navigationSections.flatMap((section) => section.items), pathname)
  const activeIntro = matchModuleIntro(navigationSections, pathname)

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
        aria-label={t("nav.menu")}
        className={cn(
          "flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden py-3",
          collapsed ? "items-center px-2" : "px-3",
        )}
        aria-busy={isLoading}
      >
        {navigationSections.map((section, index) => (
          <Fragment key={section.titleKey}>
            {index > 0 && <Separator className="-my-2.5 bg-[var(--sidebar-border)]" />}
            <NavigationSection
              section={section}
              match={match}
              activeIntroKey={activeIntro?.key}
              onNavigate={onNavigate}
              collapsed={collapsed}
              touchTargets={touchTargets}
            />
          </Fragment>
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
