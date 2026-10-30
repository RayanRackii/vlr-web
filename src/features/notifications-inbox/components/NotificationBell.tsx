import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { getAxiosErrorPayload, parseApiError } from "@/lib/api"
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
import { resolveNotificationItemRoute, resolveStaffRoute } from "@/features/notifications-inbox/lib/notificationPresentation"
import * as staffNotificationService from "@/features/notifications-inbox/services/notificationInboxService"
import type { NotificationInboxService } from "@/features/notifications-inbox/services/notificationInboxService"
import type {
  NotificationItem,
  NotificationSummaryGroup,
} from "@/features/notifications-inbox/schemas/notificationInboxSchemas"

const INBOX_MODULES = ["catalog", "rentals"] as const

export type NotificationBellProps = {
  className?: string
  service?: NotificationInboxService
  resolveRoute?: typeof resolveStaffRoute
  resolveItemRoute?: (item: NotificationItem) => string
  enabled?: boolean
  isCurrentSession?: () => boolean
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
            "bg-primary px-1 text-[0.625rem] font-semibold leading-none text-primary-foreground tabular-nums",
          )}
        >
          {unreadTotal > 99 ? overflowLabel : unreadTotal}
        </span>
      ) : null}
    </>
  )
}

/** Shared header bell; staff permissions, transport and routes remain the defaults. */
export function NotificationBell({
  className,
  service = staffNotificationService,
  resolveRoute = resolveStaffRoute,
  resolveItemRoute = resolveNotificationItemRoute,
  enabled: enabledOverride,
  isCurrentSession = () => true,
}: NotificationBellProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const permissions = useOptionalPermissions()
  const activeModules = useMemo(
    () => permissions?.activeModules ?? [],
    [permissions],
  )
  const isMobile = useViewportIsMobile()
  const [open, setOpen] = useState(false)

  const staffEnabled = useMemo(
    () => INBOX_MODULES.some((module) => activeModules.includes(module)),
    [activeModules],
  )

  const enabled = enabledOverride ?? staffEnabled
  const showGroups = service.markEventTypeRead !== undefined
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const { summary, isInitialLoading, refetch } = useNotificationSummary(enabled, service)

  const groups = useMemo(() => {
    if (!summary) {
      return []
    }
    const active = new Set(activeModules)
    return summary.groups.filter((group) => active.has(group.module))
  }, [summary, activeModules])

  const unreadTotal = useMemo(
    () => showGroups ? groups.reduce((total, group) => total + group.count, 0) : (summary?.unreadTotal ?? 0),
    [groups, showGroups, summary],
  )

  if (!enabled) {
    return null
  }

  function handleSelectGroup(group: NotificationSummaryGroup) {
    void service.markEventTypeRead?.(group.eventType)
      .then(refetch)
      .catch(() => undefined)
    void navigate(resolveRoute(group.module, group.targetRoute))
    setOpen(false)
  }

  function handleReadError(error: unknown) {
    if (showGroups || !mounted.current || !isCurrentSession() || (error instanceof DOMException && error.name === "AbortError")) return
    toast.error(parseApiError(getAxiosErrorPayload(error), t("notifications.inbox.readFailed")))
  }

  function handleSelectItem(item: NotificationItem) {
    const select = () => {
      if (!mounted.current || !isCurrentSession()) return
      void navigate(resolveItemRoute(item))
      setOpen(false)
    }
    void service.markIdsRead([item.id])
      .then(() => {
        if (!mounted.current || !isCurrentSession()) return
        refetch()
        if (!showGroups) select()
      })
      .catch(handleReadError)
    if (showGroups) select()
  }

  function handleMarkAll() {
    void service.markAllRead()
      .then(() => {
        if (!mounted.current || !isCurrentSession()) return
        refetch()
        if (!showGroups) toast.success(t("notifications.inbox.allReadSuccess"))
      })
      .catch(handleReadError)
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
      service={service}
      showGroups={showGroups}
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
            className="max-h-[80vh] gap-0 rounded-t-2xl p-3 pt-12 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
        className="max-h-[min(32rem,70vh)] w-80 max-w-[calc(100vw-1rem)] gap-0 p-2"
      >
        {panel}
      </PopoverContent>
    </Popover>
  )
}
