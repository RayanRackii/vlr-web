import { useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { LogOut, Menu } from "lucide-react"
import { useTranslation } from "react-i18next"

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { Sidebar } from "@/components/layout/Sidebar"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import {
  getEmailInitials,
  getPageTitleKey,
} from "@/components/layout/navigation"
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
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"

export function MainLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const userEmail = user?.email ?? t("account.userFallback")
  const pageTitle = t(getPageTitleKey(location.pathname))
  const initials = getEmailInitials(user?.email)

  async function handleSignOut() {
    if (isSigningOut) {
      return
    }

    setIsSigningOut(true)

    const { error } = await supabase.auth.signOut()

    if (error !== null) {
      setIsSigningOut(false)
      return
    }

    void navigate("/login", { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
        <Sidebar />
      </aside>

      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0 sm:max-w-64">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("nav.menu")}</SheetTitle>
          </SheetHeader>
          <Sidebar
            onNavigate={() => {
              setIsMobileMenuOpen(false)
            }}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => {
                setIsMobileMenuOpen(true)
              }}
              aria-label={t("nav.openMenu")}
            >
              <Menu />
            </Button>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{pageTitle}</p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {t("app.authenticatedArea")}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
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
                        {userEmail}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

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

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
