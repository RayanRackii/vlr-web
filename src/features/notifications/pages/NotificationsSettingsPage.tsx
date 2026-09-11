import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
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

function channelKey(eventType: string, channel: TenantNotificationChannel): string {
  return `${eventType}:${channel}`
}

function visibleChannels(
  events: readonly TenantNotificationEvent[],
): TenantNotificationChannel[] {
  const seen = new Set<TenantNotificationChannel>()
  const result: TenantNotificationChannel[] = []

  for (const event of events) {
    for (const item of event.channels) {
      if (seen.has(item.channel)) {
        continue
      }
      seen.add(item.channel)
      result.push(item.channel)
    }
  }

  return result
}

function patchChannelActive(
  groups: readonly TenantNotificationChannelGroup[],
  eventType: string,
  channel: TenantNotificationChannel,
  isActive: boolean,
): TenantNotificationChannelGroup[] {
  return groups.map((group) => ({
    ...group,
    events: group.events.map((event) => {
      if (event.eventType !== eventType) {
        return event
      }

      return {
        ...event,
        channels: event.channels.map((item) =>
          item.channel === channel ? { ...item, isActive } : item,
        ),
      }
    }),
  }))
}

export function NotificationsSettingsPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const canWrite = can("core.notifications.write")

  const [groups, setGroups] = useState<TenantNotificationChannelGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const next = await listNotificationChannelConfigs()
        if (cancelled) {
          return
        }
        setGroups(next)
        setLoadError(null)
      } catch (error) {
        if (cancelled) {
          return
        }
        setLoadError(
          error instanceof Error
            ? error.message
            : t("apiErrors.loadNotificationChannelConfigs"),
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [t])

  async function onToggle(
    eventType: string,
    channel: TenantNotificationChannel,
    isActive: boolean,
  ) {
    const key = channelKey(eventType, channel)
    const previous = groups
      .flatMap((group) => group.events)
      .find((event) => event.eventType === eventType)
      ?.channels.find((item) => item.channel === channel)?.isActive

    if (previous === isActive) {
      return
    }

    setBusyKey(key)
    setGroups((current) =>
      patchChannelActive(current, eventType, channel, isActive),
    )

    try {
      const updated = await updateNotificationChannelConfig({
        eventType,
        channel,
        isActive,
      })
      setGroups((current) =>
        patchChannelActive(
          current,
          updated.eventType,
          updated.channel,
          updated.isActive,
        ),
      )
      toast.success(t("notifications.settings.toastSaved"))
    } catch (error) {
      if (previous !== undefined) {
        setGroups((current) =>
          patchChannelActive(current, eventType, channel, previous),
        )
      }
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.saveNotificationChannelConfig"),
      )
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("notifications.settings.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("notifications.settings.subtitle")}
        </p>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      {loading ? (
        <PageContentSkeleton rows={5} />
      ) : groups.length === 0 && !loadError ? (
        <p className="text-sm text-muted-foreground">
          {t("notifications.settings.empty")}
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => {
            const columns = visibleChannels(group.events)

            return (
              <section key={group.module} className="space-y-3">
                <h2 className="text-lg font-semibold">
                  {t(`notifications.settings.modules.${group.module}`)}
                </h2>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t("catalog.notifications.columns.event")}
                        </TableHead>
                        {columns.map((channel) => (
                          <TableHead key={channel}>
                            {t(`catalog.channels.${channel}`)}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.events.map((event) => {
                        const eventBusy = event.channels.some(
                          (item) =>
                            busyKey ===
                            channelKey(event.eventType, item.channel),
                        )
                        const eventLabel = t(event.displayKey, {
                          defaultValue: event.eventType,
                        })

                        return (
                          <TableRow key={event.eventType}>
                            <TableCell>{eventLabel}</TableCell>
                            {columns.map((channel) => {
                              const item = event.channels.find(
                                (entry) => entry.channel === channel,
                              )

                              if (!item) {
                                return <TableCell key={channel} />
                              }

                              if (!item.configurable) {
                                return (
                                  <TableCell key={channel}>
                                    {item.isActive ? (
                                      <span
                                        className="inline-flex size-6 items-center justify-center text-primary"
                                        aria-label={t(
                                          "notifications.settings.inAppAlwaysOn",
                                        )}
                                      >
                                        <Check
                                          className="size-4"
                                          aria-hidden
                                        />
                                      </span>
                                    ) : null}
                                  </TableCell>
                                )
                              }

                              const key = channelKey(event.eventType, channel)

                              return (
                                <TableCell key={channel}>
                                  <Switch
                                    checked={item.isActive}
                                    disabled={
                                      !canWrite || eventBusy || busyKey === key
                                    }
                                    aria-label={t(
                                      "notifications.settings.toggleChannel",
                                      {
                                        event: eventLabel,
                                        channel: t(
                                          `catalog.channels.${channel}`,
                                        ),
                                      },
                                    )}
                                    onCheckedChange={(next) => {
                                      if (typeof next !== "boolean") {
                                        return
                                      }
                                      void onToggle(
                                        event.eventType,
                                        channel,
                                        next,
                                      )
                                    }}
                                  />
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
