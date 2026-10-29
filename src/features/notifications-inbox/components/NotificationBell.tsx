import { useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useOptionalPermissions } from "@/features/users/permissions/PermissionContext"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { cn } from "@/lib/utils"
import { NotificationPanel } from "@/features/notifications-inbox/components/NotificationPanel"
import { useNotificationSummary } from "@/features/notifications-inbox/hooks/useNotificationSummary"
import { useViewportIsMobile } from "@/features/notifications-inbox/hooks/useViewportIsMobile"
import { resolveStaffRoute } from "@/features/notifications-inbox/lib/notificationPresentation"
import {
  markAllRead,
  markEventTypeRead,
  markIdsRead,
} from "@/features/notifications-inbox/services/notificationInboxService"
import type {
  NotificationItem,
  NotificationSummaryGroup,
} from "@/features/notifications-inbox/schemas/notificationInboxSchemas"

const INBOX_MODULES = ["catalog", "rentals"] as const

export type NotificationBellProps = {
  className?: string
}

/** Badge glyph plus the bell icon; `unreadTotal` caps the label at `99+`. */
function BellGlyph({ unreadTotal, overflowLabel }: { unreadTotal: number; overflowLabel: string }) {
  return (
    <>
      <Bell strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
      {unreadTotal > 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full",
            "bg-primary px-1 text-[0.625rem] font-semibold leading-none text-primary-foreground",
          )}
        >
          {unreadTotal > 99 ? overflowLabel : unreadTotal}
        </span>
      ) : null}
    </>
  )
}

/**
 * Staff header bell: unread badge, 30s visibility-gated polling, and a desktop
 * popover / mobile bottom sheet. Renders nothing (and never polls) for tenants
 * without an inbox-capable active module, which keeps it off the customer
 * portal and quiet for permission-less staff.
 */
export function NotificationBell({ className }: NotificationBellProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const permissions = useOptionalPermissions()
  const activeModules = useMemo(
    () => permissions?.activeModules ?? [],
    [permissions],
  )
  const isMobile = useViewportIsMobile()
  const [open, setOpen] = useState(false)

  const enabled = useMemo(
    () => INBOX_MODULES.some((module) => activeModules.includes(module)),
    [activeModules],
  )

  const { summary, isInitialLoading, refetch } = useNotificationSummary(enabled)

  const groups = useMemo(() => {
    if (!summary) {
      return []
    }
    const active = new Set(activeModules)
    return summary.groups.filter((group) => active.has(group.module))
  }, [summary, activeModules])

  const unreadTotal = useMemo(
    () => groups.reduce((total, group) => total + group.count, 0),
    [groups],
  )

  if (!enabled) {
    return null
  }

  function handleSelectGroup(group: NotificationSummaryGroup) {
    void markEventTypeRead(group.eventType)
      .then(refetch)
      .catch(() => undefined)
    void navigate(resolveStaffRoute(group.module, group.targetRoute))
    setOpen(false)
  }

  function handleSelectItem(item: NotificationItem) {
    void markIdsRead([item.id])
      .then(refetch)
      .catch(() => undefined)
    void navigate(resolveStaffRoute(item.module, item.targetRoute))
    setOpen(false)
  }

  function handleMarkAll() {
    void markAllRead()
      .then(refetch)
      .catch(() => undefined)
  }

  const ariaLabel =
    unreadTotal === 0
      ? t("notifications.inbox.ariaLabelNone")
      : t("notifications.inbox.ariaLabel", { count: unreadTotal })
  const panel = (
    <NotificationPanel
      summary={summary}
      isLoading={isInitialLoading}
      groups={groups}
      onSelectGroup={handleSelectGroup}
      onSelectItem={handleSelectItem}
      onMarkAll={handleMarkAll}
      loadRecent={open}
    />
  )

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("relative", className)}
          aria-label={ariaLabel}
          title={ariaLabel}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <BellGlyph unreadTotal={unreadTotal} overflowLabel={t("notifications.inbox.countOverflow")} />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[80vh] gap-0 rounded-t-2xl p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{t("notifications.inbox.title")}</SheetTitle>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  const trigger: ReactNode = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("relative", className)}
      aria-label={ariaLabel}
      title={ariaLabel}
    />
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>
        <BellGlyph unreadTotal={unreadTotal} overflowLabel={t("notifications.inbox.countOverflow")} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="max-h-[min(32rem,70vh)] w-80 gap-0 p-2"
      >
        {panel}
      </PopoverContent>
    </Popover>
  )
}
