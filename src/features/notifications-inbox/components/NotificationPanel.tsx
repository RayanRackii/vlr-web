import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { cn } from "@/lib/utils"
import type {
  NotificationSummary,
  NotificationSummaryGroup,
} from "@/features/notifications-inbox/schemas/notificationInboxSchemas"
import * as staffNotificationService from "@/features/notifications-inbox/services/notificationInboxService"
import type { NotificationInboxService } from "@/features/notifications-inbox/services/notificationInboxService"
import type { NotificationItem } from "@/features/notifications-inbox/schemas/notificationInboxSchemas"
import {
  notificationItemText,
  formatRelativeTime,
  groupLabelSlug,
  moduleIcon,
} from "@/features/notifications-inbox/lib/notificationPresentation"

export type NotificationPanelProps = {
  summary: NotificationSummary | null
  isLoading: boolean
  /** Groups already filtered to the tenant's active modules. */
  groups: NotificationSummaryGroup[]
  onSelectGroup: (group: NotificationSummaryGroup) => void
  onSelectItem: (item: NotificationItem) => void
  onMarkAll: () => void
  /** Load the optional "recentes" list when the panel is visible. */
  loadRecent: boolean
  service?: NotificationInboxService
  showGroups?: boolean
}

function groupLabel(
  t: ReturnType<typeof useTranslation>["t"],
  group: NotificationSummaryGroup,
): string {
  const slug = groupLabelSlug(group.eventType)
  if (slug) {
    return t(`notifications.inbox.groups.${slug}`, { count: group.count })
  }
  return t("notifications.inbox.groups.fallback", {
    count: group.count,
    eventType: group.eventType,
  })
}

export function NotificationPanel({
  summary,
  isLoading,
  groups,
  onSelectGroup,
  onSelectItem,
  onMarkAll,
  loadRecent,
  service = staffNotificationService,
  showGroups = true,
}: NotificationPanelProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const [recent, setRecent] = useState<NotificationItem[] | null>(null)

  const recentVersion = showGroups ? null : summary
  const hasGroups = groups.length > 0
  const unreadTotal = summary?.unreadTotal ?? 0

  useEffect(() => {
    if (!loadRecent) {
      return
    }
    let active = true
    const controller = new AbortController()
    void service.listNotifications(showGroups ? { limit: 20 } : { limit: 20, unreadOnly: true }, controller.signal)
      .then((list) => {
        if (active) {
          setRecent(list.items)
        }
      })
      .catch(() => {
        // Recent list is best-effort; stay silent on failure.
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [loadRecent, service, recentVersion, showGroups])

  const recentToShow = useMemo(
    () => (recent ?? []).filter((item) => item.readAt === null),
    [recent],
  )

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          {t("notifications.inbox.title")}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn(!showGroups && "min-h-[44px]")}
          onClick={onMarkAll}
          disabled={unreadTotal === 0}
        >
          <CheckCheck strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
          {t("notifications.inbox.markAll")}
        </Button>
      </div>

      <div className="min-h-0 overflow-y-auto">
        {(isLoading && !summary) || (!showGroups && recent === null) ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {t("notifications.inbox.loading")}
          </p>
        ) : (showGroups ? !hasGroups : recentToShow.length === 0) ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            {t("notifications.inbox.empty")}
          </p>
        ) : showGroups ? (
          <ul className="flex flex-col gap-0.5" aria-label={t("notifications.inbox.title")}>
            {groups.map((group) => {
              const Icon = moduleIcon(group.module)
              return (
                <li key={group.eventType}>
                  <button
                    type="button"
                    onClick={() => onSelectGroup(group)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left",
                      "outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/15">
                      <Icon className="size-4" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {groupLabel(t, group)}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {formatRelativeTime(group.latestAt, locale)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        {recentToShow.length > 0 ? (
          <div className={cn(showGroups && "mt-2 border-t border-border pt-2")}>
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("notifications.inbox.recent")}
            </p>
            <ul className="flex flex-col gap-0.5">
              {recentToShow.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className={cn(
                      "flex min-h-11 w-full flex-col items-start gap-0.5 rounded-lg px-2 py-2 text-left",
                      "outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <span className="line-clamp-2 break-words text-sm text-foreground">
                      {showGroups ? notificationItemText(item, t) : item.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.createdAt, locale)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
