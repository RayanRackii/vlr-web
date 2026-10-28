import { useEffect, useState } from "react"
import { Bell, Check, Info, Mail, MessageCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

const channelIcons = { InApp: Bell, Email: Mail, WhatsApp: MessageCircle }

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
  const [searchParams, setSearchParams] = useSearchParams()

  const [groups, setGroups] = useState<TenantNotificationChannelGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const activeModule =
    groups.find((group) => group.module === searchParams.get("tab"))?.module ??
    groups[0]?.module
  const columns = visibleChannels(groups.flatMap((group) => group.events))

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
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
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

      <Tabs
        value={activeModule ?? ""}
        onValueChange={(value) => {
          setSearchParams((current) => {
            const next = new URLSearchParams(current)
            next.set("tab", String(value))
            return next
          })
        }}
        className="gap-4"
      >
        {!loading && groups.length > 1 ? (
          <TabsList
            variant="line"
            aria-label={t("notifications.settings.moduleTabs")}
            className="w-full justify-start rounded-none border-b border-border p-0 group-data-horizontal/tabs:h-auto"
          >
            {groups.map((group) => (
              <TabsTrigger
                key={group.module}
                value={group.module}
                className="min-h-11 flex-none rounded-none px-4 py-2 max-[759.98px]:flex-1 max-[759.98px]:px-2 after:bg-primary data-active:text-primary dark:data-active:text-foreground group-data-horizontal/tabs:after:bottom-[-1px]"
              >
                {t(`notifications.settings.modules.${group.module}`, {
                  defaultValue: group.module,
                })}
                <span
                  aria-hidden
                  className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground"
                >
                  {group.events.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}

        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>{t("notifications.settings.emailDefault")}</p>
        </div>

        {loading ? (
          <PageContentSkeleton rows={5} />
        ) : groups.length === 0 && !loadError ? (
          <p className="text-sm text-muted-foreground">
            {t("notifications.settings.empty")}
          </p>
        ) : (
          groups.filter((group) => group.module === activeModule).map((group) => {
            const groupChannels = visibleChannels(group.events)

            return (
              <TabsContent
                key={group.module}
                value={group.module}
                aria-label={t(`notifications.settings.modules.${group.module}`, {
                  defaultValue: group.module,
                })}
              >
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <Table
                    aria-label={t(
                      `notifications.settings.modules.${group.module}`,
                      { defaultValue: group.module },
                    )}
                    className="table-fixed max-[759.98px]:block"
                    containerClassName="max-[759.98px]:overflow-visible"
                  >
                    <colgroup className="max-[759.98px]:hidden">
                      <col />
                      {columns.map((channel) => (
                        <col key={channel} className="w-[136px]" />
                      ))}
                    </colgroup>
                    <TableHeader className="max-[759.98px]:hidden">
                      <TableRow>
                        <TableHead className="px-4 uppercase">
                          {t("catalog.notifications.columns.event")}
                        </TableHead>
                        {columns.map((channel) => {
                          const Icon = channelIcons[channel]
                          return (
                            <TableHead key={channel} className="text-center uppercase">
                              {groupChannels.includes(channel) ? (
                                <span className="inline-flex items-center gap-2">
                                  <Icon className="size-4" aria-hidden />
                                  {t(`catalog.channels.${channel}`)}
                                </span>
                              ) : null}
                            </TableHead>
                          )
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="max-[759.98px]:block">
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
                          <TableRow
                            key={event.eventType}
                            className="max-[759.98px]:block max-[759.98px]:px-4 max-[759.98px]:py-3"
                          >
                            <TableCell className="whitespace-normal px-4 py-3 font-semibold max-[759.98px]:block max-[759.98px]:px-0 max-[759.98px]:pb-1 max-[759.98px]:pt-0">
                              {eventLabel}
                            </TableCell>
                            {columns.map((channel) => {
                              const item = event.channels.find(
                                (entry) => entry.channel === channel,
                              )

                              if (!item) {
                                return (
                                  <TableCell
                                    key={channel}
                                    className="max-[759.98px]:hidden"
                                  />
                                )
                              }

                              const Icon = channelIcons[channel]
                              const key = channelKey(event.eventType, channel)

                              return (
                                <TableCell
                                  key={channel}
                                  className="py-1 text-center max-[759.98px]:flex max-[759.98px]:min-h-11 max-[759.98px]:items-center max-[759.98px]:justify-between max-[759.98px]:px-0 max-[759.98px]:py-0"
                                >
                                  <span
                                    aria-hidden
                                    className="hidden items-center gap-2 text-muted-foreground max-[759.98px]:inline-flex"
                                  >
                                    <Icon className="size-4" />
                                    {t(`catalog.channels.${channel}`)}
                                  </span>
                                  {!item.configurable ? (
                                    item.isActive ? (
                                      <span
                                        className="inline-flex size-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        aria-label={t(
                                          "notifications.settings.inAppAlwaysOn",
                                        )}
                                      >
                                        <Check
                                          className="size-4"
                                          aria-hidden
                                        />
                                      </span>
                                    ) : null
                                  ) : (
                                    <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
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
                                    </label>
                                  )}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            )
          })
        )}
      </Tabs>
    </div>
  )
}
