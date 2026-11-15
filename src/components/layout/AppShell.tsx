import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { CircleUser, LogOut, Menu } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { CONTENT_WIDTH_CLASS } from "@/components/layout/contentWidth"
import { headerTouchTargetClassName } from "@/components/layout/headerTouchTarget"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { ShellContext } from "@/components/layout/ShellContext"
import { SidebarAccount } from "@/components/layout/SidebarAccount"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { NotificationBell } from "@/features/notifications-inbox/components/NotificationBell"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { cn } from "@/lib/utils"

/** Options handed to the sidebar render prop so it can adapt to the shell. */
export type SidebarRenderOptions = {
  /** Called after a navigation action — closes the mobile drawer. */
  onNavigate?: () => void
  /** Desktop rail is collapsed to an icon-only strip. */
  collapsed?: boolean
  /** Toggles the desktop collapsed state; absent when not collapsible. */
  onToggleCollapsed?: () => void
  /** Render larger (≥44px) hit areas — set in the mobile drawer. */
  touchTargets?: boolean
  /** Staff only: the user card (account menu) pinned at the bottom of the sidebar. */
  account?: ReactNode
}

export type AppShellProps = {
  /** Portal uses top navigation that becomes bottom navigation on mobile. */
  variant?: "staff" | "portal"
  sidebar: (opts: SidebarRenderOptions) => ReactNode
  pageTitle: string
  userLabel: string
  initials: string
  onSignOut: () => void | Promise<void>
  /** When set, account menu shows Meu Perfil above Sign out. Omit for B2B. */
  profileTo?: string
  /** At least 44×44px hit area on header icon buttons. Icon glyph size stays put. */
  enlargeHeaderTargets?: boolean
  /** Show PT/EN/ES beside the language icon on every viewport. */
  showLanguageCode?: boolean
  /** Subtitle under the page title. Staff shell passes the tenant name. */
  contextLabel?: string
  /** Staff only: the user's email, shown in the account menu. */
  userEmail?: string
  /** Staff only: second line of the sidebar user card (role). */
  userRoleLabel?: string
  /** Staff only: top-bar start slot (the breadcrumb). */
  headerStart?: ReactNode
  /** Enable the desktop collapse rail (persisted). B2B opts in; B2C stays fixed. */
  collapsible?: boolean
  /** Center and cap the content width for a steady reading measure. */
  constrainContent?: boolean
  headerActions?: ReactNode
  banner?: ReactNode
  /**
   * Focus layout (staff only, cadastro wizards): no sidebar. Compact top bar with the brand mark,
   * `headerStart` (breadcrumb) and, on the right, the workspace name plus the account menu.
   */
  focus?: boolean
  /** Focus layout: workspace name shown beside the avatar. */
  workspaceName?: string
  children: ReactNode
}

const FOCUS_SHELL_CONTEXT = { breadcrumbInHeader: true }

const SIDEBAR_COLLAPSED_STORAGE_KEY = "rolvix.shell.sidebarCollapsed"

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function AppShell({
  variant = "staff",
  sidebar,
  pageTitle,
  userLabel,
  initials,
  onSignOut,
  profileTo,
  enlargeHeaderTargets = false,
  showLanguageCode = false,
  contextLabel,
  userEmail,
  userRoleLabel,
  headerStart,
  collapsible = false,
  constrainContent = false,
  headerActions,
  banner = null,
  focus = false,
  workspaceName,
  children,
}: AppShellProps) {
  const { t } = useTranslation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(
    () => collapsible && readStoredCollapsed(),
  )

  useEffect(() => {
    if (!collapsible || typeof window === "undefined") {
      return
    }
    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_STORAGE_KEY,
        isCollapsed ? "1" : "0",
      )
    } catch {
      // Persisting the preference is best-effort; ignore storage failures.
    }
  }, [collapsible, isCollapsed])

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((previous) => !previous)
  }, [])

  async function handleSignOut() {
    if (isSigningOut) {
      return
    }

    setIsSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  const headerIconClassName = cn(
    variant === "staff" && "touch-target",
    enlargeHeaderTargets && headerTouchTargetClassName,
  )

  const collapsed = collapsible && isCollapsed
  const shellContext = useMemo(
    () => ({ breadcrumbInHeader: variant === "staff" && headerStart != null }),
    [variant, headerStart],
  )

  function renderAccount(opts: { collapsed?: boolean; touchTargets?: boolean; side?: "top" | "bottom" }) {
    return (
      <SidebarAccount
        userLabel={userLabel}
        email={userEmail}
        initials={initials}
        roleLabel={userRoleLabel}
        profileTo={profileTo}
        isSigningOut={isSigningOut}
        onSignOut={() => {
          void handleSignOut()
        }}
        collapsed={opts.collapsed}
        touchTargets={opts.touchTargets}
        side={opts.side}
      />
    )
  }

  if (focus && variant === "staff") {
    const brandName = t("app.name")
    return (
      <ShellContext.Provider value={FOCUS_SHELL_CONTEXT}>
        <div data-shell-part="root" data-shell-variant="focus" className="flex min-h-screen max-w-full bg-background text-foreground">
          <div data-shell-part="body" className="flex min-w-0 flex-1 flex-col">
            <header data-shell-part="header" className="sticky top-0 z-20 flex h-14 min-w-0 max-w-full items-center justify-between gap-3 border-b border-border bg-background px-4 lg:px-8">
              <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-12">
                <span className="flex shrink-0 items-center gap-2.5">
                  <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">{brandName.charAt(0).toUpperCase()}</span>
                  <span className="text-base font-semibold tracking-tight">{brandName}</span>
                </span>
                <div data-shell-part="header-start" className="hidden min-w-0 sm:block">{headerStart}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {workspaceName ? <span data-shell-part="workspace-name" className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">{workspaceName}</span> : null}
                {renderAccount({ collapsed: true, touchTargets: true, side: "bottom" })}
              </div>
            </header>
            {banner}
            <main data-shell-part="main" className="min-w-0 max-w-full flex-1 overflow-x-auto bg-muted/30 p-4 md:p-6 lg:px-8 lg:py-10">
              {children}
            </main>
          </div>
        </div>
      </ShellContext.Provider>
    )
  }

  return (
    <ShellContext.Provider value={shellContext}>
    <div data-shell-part="root" data-shell-variant={variant} className="flex min-h-screen max-w-full bg-background text-foreground">
      {variant === "staff" && <aside
        data-shell-part="sidebar"
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block",
          "transition-[width] duration-200 ease-out motion-reduce:transition-none",
          collapsed ? "w-[4.25rem]" : "w-56",
        )}
      >
        {sidebar({
          collapsed,
          onToggleCollapsed: collapsible ? toggleCollapsed : undefined,
          account: renderAccount({ collapsed }),
        })}
      </aside>}

      {variant === "staff" && <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-72 p-0 sm:max-w-72">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("nav.menu")}</SheetTitle>
          </SheetHeader>
          {sidebar({
            touchTargets: true,
            account: renderAccount({ touchTargets: true }),
            onNavigate: () => {
              setIsMobileMenuOpen(false)
            },
          })}
        </SheetContent>
      </Sheet>}

      <div data-shell-part="body" className="flex min-w-0 flex-1 flex-col">
        <header data-shell-part="header" className={cn("sticky top-0 z-20 flex min-w-0 max-w-full items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/65", variant === "staff" ? "h-16 lg:px-8" : "h-14")}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              data-shell-part="menu-toggle"
              hidden={variant === "portal"}
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn("lg:hidden", headerIconClassName)}
              onClick={() => {
                setIsMobileMenuOpen(true)
              }}
              aria-label={t("nav.openMenu")}
              title={t("nav.openMenu")}
            >
              <Menu strokeWidth={ICON_STROKE_WIDTH} />
            </Button>

            <div className="min-w-0">
              {/* The page body already renders its own H1; keep the top-bar title for
                  mobile (sidebar/nav hidden there) and demote it on larger screens so it
                  doesn't read as a duplicate heading. */}
              <p className="min-w-0 break-words text-sm font-semibold tracking-tight [overflow-wrap:anywhere] lg:hidden">
                {pageTitle}
              </p>
              {variant === "staff" ? (
                <div data-shell-part="header-start" className="hidden min-w-0 lg:block">
                  {headerStart}
                </div>
              ) : (
                <p className="hidden truncate text-xs text-muted-foreground sm:block lg:text-sm lg:font-medium lg:text-foreground">
                  {contextLabel ?? t("app.authenticatedArea")}
                </p>
              )}
            </div>
          </div>

          {variant === "portal" && sidebar({})}

          <div className="flex shrink-0 items-center gap-0.5">
            <LanguageSwitcher
              className={headerIconClassName}
              showShortLabel={showLanguageCode || variant === "staff"}
            />
            {variant === "portal" ? <ThemeToggle className={headerIconClassName} /> : null}

            {variant === "staff" ? (
              <NotificationBell className={headerIconClassName} />
            ) : headerActions}

            {variant === "staff" ? (
              <div className="lg:hidden">
                <SidebarAccount
                  userLabel={userLabel}
                  email={userEmail}
                  initials={initials}
                  roleLabel={userRoleLabel}
                  profileTo={profileTo}
                  isSigningOut={isSigningOut}
                  onSignOut={() => {
                    void handleSignOut()
                  }}
                  collapsed
                  side="bottom"
                  className={headerIconClassName}
                />
              </div>
            ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("rounded-full", headerIconClassName)}
                    aria-label={t("account.openMenu")}
                    title={userLabel}
                  />
                }
              >
                <Avatar size="sm">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" side="bottom" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5 px-0.5 py-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {t("account.title")}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {userLabel}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                {profileTo ? (
                  <>
                    <DropdownMenuItem
                      className="min-h-11 md:min-h-9"
                      nativeButton={false}
                      render={<Link to={profileTo} />}
                    >
                      <CircleUser />
                      <span>{t("account.profile")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}

                <DropdownMenuItem
                  className="min-h-11 md:min-h-9"
                  variant="destructive"
                  disabled={isSigningOut}
                  onClick={() => {
                    void handleSignOut()
                  }}
                >
                  <LogOut />
                  <span>
                    {isSigningOut
                      ? t("account.signingOut")
                      : t("account.signOut")}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        </header>

        {banner}

        <main data-shell-part="main" className="min-w-0 max-w-full flex-1 overflow-x-auto overflow-y-auto p-4 md:p-6 lg:p-8">
          {constrainContent ? (
            <div className={cn("mx-auto min-w-0 w-full", CONTENT_WIDTH_CLASS)}>{children}</div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
    </ShellContext.Provider>
  )
}
