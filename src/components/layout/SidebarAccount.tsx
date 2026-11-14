import { CircleUser, LogOut, Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

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
import { cn } from "@/lib/utils"

export type SidebarAccountProps = {
  userLabel: string
  email?: string
  initials: string
  /** Second line of the card (role). Omitted when unknown. */
  roleLabel?: string
  profileTo?: string
  isSigningOut: boolean
  onSignOut: () => void
  /** Avatar only: collapsed rail and the mobile top bar. */
  collapsed?: boolean
  /** Where the menu opens: above the sidebar card, below the top bar avatar. */
  side?: "top" | "bottom"
  /** Larger (>=44px) hit area for touch. */
  touchTargets?: boolean
  className?: string
}

/** User card pinned to the bottom of the staff sidebar; the whole card opens the account menu. */
export function SidebarAccount({
  userLabel,
  email,
  initials,
  roleLabel,
  profileTo,
  isSigningOut,
  onSignOut,
  collapsed = false,
  side = "top",
  touchTargets = false,
  className,
}: SidebarAccountProps) {
  const { t } = useTranslation()
  const { setTheme } = useTheme()
  const itemClassName = "min-h-11 md:min-h-9"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          collapsed ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("rounded-full", touchTargets && "min-h-11 min-w-11", className)}
              aria-label={t("account.openMenu")}
              title={userLabel}
            />
          ) : (
            <button
              type="button"
              aria-label={t("account.openMenu")}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                touchTargets ? "min-h-11 py-2" : "py-1.5",
                className,
              )}
            />
          )
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        {collapsed ? null : (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{userLabel}</span>
            {roleLabel ? (
              <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
            ) : null}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align={side === "top" ? "start" : "end"} side={side} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5 px-0.5 py-0.5">
              <span className="truncate text-sm font-medium text-foreground">{userLabel}</span>
              {email ? (
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              ) : null}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {profileTo ? (
          <DropdownMenuItem
            className={itemClassName}
            nativeButton={false}
            render={<Link to={profileTo} />}
          >
            <CircleUser />
            <span>{t("account.profile")}</span>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem className={itemClassName} onClick={() => setTheme("light")}>
          <Sun />
          <span>{t("theme.light")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem className={itemClassName} onClick={() => setTheme("dark")}>
          <Moon />
          <span>{t("theme.dark")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem className={itemClassName} onClick={() => setTheme("system")}>
          <Monitor />
          <span>{t("theme.system")}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className={itemClassName}
          variant="destructive"
          disabled={isSigningOut}
          onClick={onSignOut}
        >
          <LogOut />
          <span>{isSigningOut ? t("account.signingOut") : t("account.signOut")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
