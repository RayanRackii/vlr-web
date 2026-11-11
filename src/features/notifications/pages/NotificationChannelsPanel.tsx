import { useEffect, useState, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Checkbox } from "@/components/ui/checkbox"
import {
  listNotificationChannelConfigs,
  updateNotificationChannelConfig,
} from "@/features/notifications/services/notificationChannelConfigService"
import type {
  TenantNotificationChannel,
  TenantNotificationChannelGroup,
  TenantNotificationEvent,
} from "@/features/notifications/schemas/notificationChannelConfigSchemas"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

const CHANNEL_ORDER = ["Email", "WhatsApp", "InApp", "Sms"]

function channelKey(eventType: string, channel: TenantNotificationChannel): string {
  return `${eventType}:${channel}`
}

function channelsFor(events: readonly TenantNotificationEvent[]): TenantNotificationChannel[] {
  const present = new Set<TenantNotificationChannel>()
  for (const event of events) {
    for (const item of event.channels) present.add(item.channel)
  }
  return [...present].sort((left, right) => {
    const leftIndex = CHANNEL_ORDER.indexOf(left)
    const rightIndex = CHANNEL_ORDER.indexOf(right)
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex)
  })
}

function patchChannelActive(
  groups: readonly TenantNotificationChannelGroup[],
  eventType: string,
  channel: TenantNotificationChannel,
  isActive: boolean,
): TenantNotificationChannelGroup[] {
  return groups.map((group) => ({
    ...group,
    events: group.events.map((event) => event.eventType === eventType
      ? { ...event, channels: event.channels.map((item) => item.channel === channel ? { ...item, isActive } : item) }
      : event),
  }))
}

export function NotificationChannelsPanel() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const canWrite = can("core.notifications.write")
  const [groups, setGroups] = useState<TenantNotificationChannelGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listNotificationChannelConfigs().then((next) => {
      if (cancelled) return
      setGroups(next)
      setLoadError(null)
    }).catch((error: unknown) => {
      if (cancelled) return
      setLoadError(error instanceof Error ? error.message : t("apiErrors.loadNotificationChannelConfigs"))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [t])

  async function onToggle(eventType: string, channel: TenantNotificationChannel, isActive: boolean) {
    const key = channelKey(eventType, channel)
    const previous = groups.flatMap((group) => group.events).find((event) => event.eventType === eventType)
      ?.channels.find((item) => item.channel === channel)?.isActive
    if (previous === isActive) return
    setBusyKey(key)
    setGroups((current) => patchChannelActive(current, eventType, channel, isActive))
    try {
      const updated = await updateNotificationChannelConfig({ eventType, channel, isActive })
      setGroups((current) => patchChannelActive(current, updated.eventType, updated.channel, updated.isActive))
      toast.success(t("notifications.settings.toastSaved"))
    } catch (error: unknown) {
      if (previous !== undefined) setGroups((current) => patchChannelActive(current, eventType, channel, previous))
      toast.error(error instanceof Error ? error.message : t("apiErrors.saveNotificationChannelConfig"))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="notification-channels-title">
      <div>
        <h2 id="notification-channels-title" className="text-base font-semibold">{t("notifications.page.channelsTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("notifications.page.channelsSubtitle")}</p>
      </div>
      {loadError ? <p role="alert" className="text-sm text-destructive">{loadError}</p> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p> : null}
      {!loading && !loadError && groups.length === 0 ? (
        <div className="notifications-card notifications-empty" role="status">
          <h3 className="text-base font-semibold">{t("notifications.page.emptyChannelsTitle")}</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t("notifications.page.emptyChannels")}</p>
        </div>
      ) : null}
      {!loading && !loadError ? groups.map((group) => {
        const columns = channelsFor(group.events)
        return (
          <article key={group.module} className="notifications-card" style={{ "--channels": Math.max(columns.length, 1) } as CSSProperties & { "--channels": number }}>
            <div className="notifications-matrix-head">
              <h3 className="text-sm font-semibold">{t(`notifications.page.modules.${group.module}`, { defaultValue: group.module })}</h3>
              {columns.map((channel) => <span key={channel}>{t(`catalog.channels.${channel}`)}</span>)}
            </div>
            {group.events.map((event) => {
              const eventLabel = t(event.displayKey, { defaultValue: event.eventType })
              const eventBusy = event.channels.some((item) => busyKey === channelKey(event.eventType, item.channel))
              return (
                <div key={event.eventType} className="notifications-matrix-row">
                  <div className="notifications-event min-w-0">
                    <p className="text-sm font-medium">{eventLabel}</p>
                  </div>
                  {columns.map((channel) => {
                    const item = event.channels.find((entry) => entry.channel === channel)
                    if (!item) return <span key={channel} />
                    const channelLabel = t(`catalog.channels.${channel}`)
                    const label = item.configurable
                      ? t("notifications.settings.toggleChannel", { event: eventLabel, channel: channelLabel })
                      : `${eventLabel} · ${channelLabel} · ${t(item.isActive ? "notifications.settings.inAppAlwaysOn" : "notifications.settings.channelUnavailable")}`
                    return (
                      <label key={channel} className="notifications-check">
                        <Checkbox
                          checked={item.isActive}
                          disabled={!item.configurable || !canWrite || eventBusy}
                          aria-label={label}
                          onChange={(change) => {
                            if (!item.configurable || !canWrite) return
                            void onToggle(event.eventType, channel, change.target.checked)
                          }}
                        />
                        <span className="notifications-channel-name">{channelLabel}</span>
                      </label>
                    )
                  })}
                </div>
              )
            })}
          </article>
        )
      }) : null}
    </section>
  )
}
