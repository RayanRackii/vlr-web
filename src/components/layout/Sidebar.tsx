import { type ReactNode, useId, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChevronDown, Info, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  /** Tenant name shown in the workspace card (display only). */
  workspaceName?: string
  /** Platform admin on the platform panel: the card shows the platform label instead. */
  platformWorkspace?: boolean
  /** User card pinned at the bottom (rendered by the shell). */
  account?: ReactNode
}

const SIDEBAR_LABEL_KEYS: Partial<Record<AppNavigationItem["labelKey"], string>> = {
  "nav.peopleAccess": "nav.sidebar.people",
  "nav.catalogCustomerGroups": "nav.sidebar.groups",
  "nav.layout": "nav.sidebar.map",
  "nav.catalogSettings": "nav.sidebar.sales",
  "nav.notifications": "nav.sidebar.notifications",
}

const NAV_ICON_CLASS = "size-4.5 shrink-0"
const SETTINGS_SECTION_KEY: AppNavigationSection["titleKey"] = "nav.sections.settings"

/** Soft-tinted active fill + rested/hover treatment, shared by leaf and child rows. */
function rowClassName(isActive: boolean, touchTargets: boolean | undefined) {
  return cn(
    "group/nav relative flex items-center gap-3 rounded-lg px-3 text-sm outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    touchTargets ? "min-h-11 py-2" : "min-h-9 py-1.5",
    isActive
      ? "bg-primary/10 font-medium text-primary dark:bg-primary/15"
      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  )
}

/** Quiet chevron toggle used after section labels and group rows. */
function ChevronToggle({
  expanded,
  label,
  controls,
  touchTargets,
  onClick,
}: {
  expanded: boolean
  label: string
  controls: string
  touchTargets?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        touchTargets ? "size-11" : "size-7",
      )}
    >
      <ChevronDown
        className={cn("size-4 transition-transform duration-150 motion-reduce:transition-none", !expanded && "-rotate-90")}
        aria-hidden="true"
      />
    </button>
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
  const label = t(SIDEBAR_LABEL_KEYS[item.labelKey] ?? item.labelKey)
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
                    ? "bg-primary/10 font-medium text-primary dark:bg-primary/15"
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

  // Expanded group: icon row with a quiet chevron + children indented to the parent's text start.
  if (hasChildren && children !== undefined) {
    return (
      <div className="space-y-0.5">
        <div
          className={cn("flex items-center rounded-lg text-sm", isIntroActive ? "bg-primary/10 font-medium text-primary" : isSectionActive ? "font-medium text-foreground" : "text-muted-foreground")}
        >
          {item.introKey ? (
            <Link
              to={moduleIntroPath(item.introKey)}
              title={tooltip}
              aria-label={t("moduleIntro.open", { module: label })}
              aria-current={isIntroActive ? "page" : undefined}
              onClick={onNavigate}
              className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-1.5 outline-none hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring", touchTargets ? "min-h-11" : "min-h-9")}
            >
              <Icon className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
              <span className="min-w-0 whitespace-normal break-words">{label}</span>
            </Link>
          ) : (
            <span title={tooltip} className="flex min-h-9 min-w-0 flex-1 items-center gap-3 px-3 py-1.5">
              <Icon className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
              <span className="min-w-0 whitespace-normal break-words">{label}</span>
            </span>
          )}
          <ChevronToggle
            expanded={expanded}
            label={t(expanded ? "moduleIntro.collapse" : "moduleIntro.expand", { module: label })}
            controls={childrenId}
            touchTargets={touchTargets}
            onClick={() => setExpanded((value) => !value)}
          />
        </div>

        <div id={childrenId} hidden={!expanded} className="space-y-0.5">
          {children.map((child) => (
            <Link
              key={child.to}
              to={child.to}
              aria-current={match?.child === child ? "page" : undefined}
              onClick={onNavigate}
              className={
                cn(
                  "relative flex items-center rounded-lg pl-[2.625rem] pr-3 text-sm outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  touchTargets ? "min-h-11 py-2" : "min-h-9 py-1.5",
                  match?.child === child
                    ? "bg-primary/10 font-medium text-primary dark:bg-primary/15"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )
              }
            >
              <span className="min-w-0 whitespace-normal break-words">{t(child.labelKey)}</span>
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
      <Icon className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
      <span className="min-w-0 whitespace-normal break-words">{label}</span>
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
  const [expanded, setExpanded] = useState(!section.defaultCollapsed)
  const itemsId = useId()
  const label = t(section.titleKey)
  const isIntroActive = section.introKey !== undefined && section.introKey === activeIntroKey

  return (
    <div className={cn("flex w-full flex-col gap-0.5", collapsed && "items-center gap-1")}>
      {!section.standalone && <div className={cn("flex items-center text-muted-foreground", collapsed && "justify-center")}>
        {section.introKey ? (
          <Link
            to={moduleIntroPath(section.introKey)}
            aria-label={t("moduleIntro.open", { module: label })}
            aria-current={isIntroActive ? "page" : undefined}
            onClick={onNavigate}
            className={cn("flex min-w-0 items-center rounded-lg outline-none hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring", collapsed ? "size-10 justify-center" : "flex-1 px-3 text-xs font-medium uppercase tracking-wide", !collapsed && (touchTargets ? "min-h-11" : "min-h-8"), isIntroActive && "bg-primary/10 text-primary")}
          >
            {collapsed ? <Info className="size-4" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" /> : <span className="min-w-0 whitespace-normal break-words">{label}</span>}
          </Link>
        ) : !collapsed && <p className="flex-1 px-3 text-xs font-medium uppercase tracking-wide">{label}</p>}
        {!collapsed && (
          <ChevronToggle
            expanded={expanded}
            label={t(expanded ? "moduleIntro.collapse" : "moduleIntro.expand", { module: label })}
            controls={itemsId}
            touchTargets={touchTargets}
            onClick={() => setExpanded((value) => !value)}
          />
        )}
      </div>}
      <div id={itemsId} hidden={!collapsed && !expanded} className={cn("space-y-0.5", collapsed && "flex flex-col items-center gap-1")}>
        {section.items.map((item) => (
          <NavigationLink key={item.to} item={item} match={match} activeIntroKey={activeIntroKey} onNavigate={onNavigate} collapsed={collapsed} touchTargets={touchTargets} />
        ))}
      </div>
    </div>
  )
}

/** The settings section as one pinned row: expands its items inline above it; the collapsed rail opens a flyout. */
function SettingsGroup({
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
  const [expanded, setExpanded] = useState(!section.defaultCollapsed)
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const itemsId = useId()
  const label = t(section.titleKey)
  const hasActiveItem = section.items.some(
    (item) => match?.item === item || (item.introKey !== undefined && item.introKey === activeIntroKey),
  )
  const toggleLabel = t(
    (collapsed ? flyoutOpen : expanded) ? "moduleIntro.collapse" : "moduleIntro.expand",
    { module: label },
  )

  if (collapsed) {
    return (
      <Popover open={flyoutOpen} onOpenChange={setFlyoutOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={toggleLabel}
              title={label}
              className={cn(
                "flex size-10 items-center justify-center rounded-lg outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                hasActiveItem
                  ? "bg-primary/10 font-medium text-primary dark:bg-primary/15"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            />
          }
        >
          <Settings className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent side="right" align="end" sideOffset={8} className="w-56 gap-0.5 p-1.5">
          <p className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">{label}</p>
          {section.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={match?.item === item ? "page" : undefined}
              onClick={() => {
                setFlyoutOpen(false)
                onNavigate?.()
              }}
              className={cn(
                "flex min-h-9 items-center rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ease-out motion-reduce:transition-none",
                match?.item === item
                  ? "bg-primary/10 font-medium text-primary dark:bg-primary/15"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              {t(SIDEBAR_LABEL_KEYS[item.labelKey] ?? item.labelKey)}
            </Link>
          ))}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <nav aria-label={label} className="flex w-full flex-col gap-0.5">
      <div id={itemsId} hidden={!expanded} className="space-y-0.5 pb-1">
        {section.items.map((item) => (
          <NavigationLink key={item.to} item={item} match={match} activeIntroKey={activeIntroKey} onNavigate={onNavigate} touchTargets={touchTargets} />
        ))}
      </div>
      <button
        type="button"
        aria-label={toggleLabel}
        aria-expanded={expanded}
        aria-controls={itemsId}
        onClick={() => setExpanded((value) => !value)}
        className={cn(rowClassName(false, touchTargets), "w-full", hasActiveItem && "text-foreground")}
      >
        <Settings className={NAV_ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronDown
          className={cn("size-4 transition-transform duration-150 motion-reduce:transition-none", expanded && "rotate-180")}
          aria-hidden="true"
        />
      </button>
    </nav>
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
  workspaceName,
  platformWorkspace,
  account,
}: SidebarProps) {
  const { t } = useTranslation()
  const { sections: navigationSections, isLoading } = useAppNavigationSections()
  const { pathname } = useLocation()
  const match = matchNavigationPath(navigationSections.flatMap((section) => section.items), pathname)
  const activeIntro = matchModuleIntro(navigationSections, pathname)
  const mainSections = navigationSections.filter((section) => section.titleKey !== SETTINGS_SECTION_KEY)
  const settingsSection = navigationSections.find((section) => section.titleKey === SETTINGS_SECTION_KEY)
  const brandName = t("app.name")
  const workspaceLabel = platformWorkspace ? t("nav.platformWorkspace") : workspaceName
  const workspaceInitial = workspaceLabel?.trim().charAt(0).toUpperCase() ?? ""

  const toggleButton = onToggleCollapsed ? (
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
  ) : null

  const brandMark = (
    <span
      data-sidebar-mark
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
    >
      {brandName.charAt(0).toUpperCase()}
    </span>
  )

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {collapsed ? (
        <div className="flex flex-col items-center gap-1 px-2 pb-1 pt-4">
          {brandMark}
          {toggleButton}
        </div>
      ) : (
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-4">
          <span className="flex min-w-0 items-center gap-2.5">
            {brandMark}
            <span className="truncate text-base font-semibold tracking-tight">{brandName}</span>
          </span>
          {toggleButton}
        </div>
      )}

      {workspaceLabel ? (
        collapsed ? (
          <div
            data-testid="sidebar-workspace"
            title={workspaceLabel}
            className="mx-auto mt-2 flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sm font-medium"
          >
            {workspaceInitial}
          </div>
        ) : (
          <div data-testid="sidebar-workspace" className="mx-3 shrink-0 rounded-lg bg-sidebar-accent px-3 py-2.5">
            <p className="truncate text-sm font-medium">{workspaceLabel}</p>
            <p className="truncate text-xs text-muted-foreground">{t("nav.workspaceCaption")}</p>
          </div>
        )
      ) : null}

      <nav
        aria-label={t("nav.menu")}
        className={cn(
          "flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden py-3",
          collapsed ? "items-center px-2" : "px-3",
        )}
        aria-busy={isLoading}
      >
        {mainSections.map((section) => (
          <NavigationSection
            key={section.titleKey}
            section={section}
            match={match}
            activeIntroKey={activeIntro?.key}
            onNavigate={onNavigate}
            collapsed={collapsed}
            touchTargets={touchTargets}
          />
        ))}
        {isLoading ? (
          <SidebarNavigationSkeleton
            label={t("nav.loading")}
            collapsed={collapsed}
          />
        ) : null}
      </nav>

      {settingsSection || account ? (
        <div
          data-testid="sidebar-bottom"
          className={cn(
            "mt-auto flex shrink-0 flex-col gap-1 border-t border-sidebar-border py-2",
            collapsed ? "items-center px-2" : "px-3",
          )}
        >
          {settingsSection ? (
            <SettingsGroup
              section={settingsSection}
              match={match}
              activeIntroKey={activeIntro?.key}
              onNavigate={onNavigate}
              collapsed={collapsed}
              touchTargets={touchTargets}
            />
          ) : null}
          {account}
        </div>
      ) : null}
    </div>
  )
}
