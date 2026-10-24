import { type ReactNode, useCallback, useEffect, useState } from "react"
import { CircleUser, LogOut, Menu } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { headerTouchTargetClassName } from "@/components/layout/headerTouchTarget"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
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
}

export type AppShellProps = {
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
  /** Enable the desktop collapse rail (persisted). B2B opts in; B2C stays fixed. */
  collapsible?: boolean
  /** Center and cap the content width for a steady reading measure. */
  constrainContent?: boolean
  banner?: ReactNode
  children: ReactNode
}

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
  sidebar,
  pageTitle,
  userLabel,
  initials,
  onSignOut,
  profileTo,
  enlargeHeaderTargets = false,
  showLanguageCode = false,
  contextLabel,
  collapsible = false,
  constrainContent = false,
  banner = null,
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

  const headerIconClassName = enlargeHeaderTargets
    ? headerTouchTargetClassName
    : undefined

  const collapsed = collapsible && isCollapsed

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block",
          "transition-[width] duration-200 ease-out motion-reduce:transition-none",
          collapsed ? "w-[4.25rem]" : "w-64",
        )}
      >
        {sidebar({
          collapsed,
          onToggleCollapsed: collapsible ? toggleCollapsed : undefined,
        })}
      </aside>

      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-72 p-0 sm:max-w-72">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("nav.menu")}</SheetTitle>
          </SheetHeader>
          {sidebar({
            touchTargets: true,
            onNavigate: () => {
              setIsMobileMenuOpen(false)
            },
          })}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn("lg:hidden", headerIconClassName)}
              onClick={() => {
                setIsMobileMenuOpen(true)
              }}
              aria-label={t("nav.openMenu")}
            >
              <Menu strokeWidth={ICON_STROKE_WIDTH} />
            </Button>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                {pageTitle}
              </p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {contextLabel ?? t("app.authenticatedArea")}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <LanguageSwitcher
              className={headerIconClassName}
              showShortLabel={showLanguageCode}
            />
            <ThemeToggle className={headerIconClassName} />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("rounded-full", headerIconClassName)}
                    aria-label={t("account.openMenu")}
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
          </div>
        </header>

        {banner}

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {constrainContent ? (
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
