import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NotificationChannelsPanel } from "@/features/notifications/pages/NotificationChannelsPanel"
import { NotificationHistoryPanel } from "@/features/notifications/pages/NotificationHistoryPanel"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import "@/features/notifications/pages/notifications.css"

const TABS = ["canais", "historico"] as const
type NotificationsTab = (typeof TABS)[number]

export function NotificationsPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const canChannels = can("core.notifications.read")
  const canHistory = can("core.notifications.read") || can("catalog.notifications.read")
  const tabs = TABS.filter((tab) => tab === "canais" ? canChannels : canHistory)
  const requested = searchParams.get("aba")
  const tab: NotificationsTab | undefined = tabs.find((item) => item === requested) ?? tabs[0]

  function selectTab(value: NotificationsTab) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("aba", value)
      return next
    })
  }

  if (!tab) return <AccessDeniedPage />

  return (
    <div className="notifications-page mx-auto min-w-0 space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("nav.notifications")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("notifications.page.subtitle")}</p>
        <Tabs value={tab} onValueChange={(value) => selectTab(value as NotificationsTab)}>
          <TabsList variant="line" activateOnFocus aria-label={t("nav.notifications")}>
            {tabs.map((value) => (
              <TabsTrigger key={value} value={value} id={`notifications-tab-${value}`} aria-controls={`notifications-panel-${value}`}>
                {t(value === "canais" ? "notifications.page.tabs.channels" : "notifications.page.tabs.history")}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>
      <div role="tabpanel" id={`notifications-panel-${tab}`} aria-labelledby={`notifications-tab-${tab}`}>
        {tab === "canais" ? <NotificationChannelsPanel /> : <NotificationHistoryPanel />}
      </div>
    </div>
  )
}
