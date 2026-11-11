import { useRef } from "react"
import { Clock, Mail } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
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
        <p className="notifications-eyebrow">{t("nav.sections.settings")}</p>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("nav.notifications")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("notifications.page.subtitle")}</p>
        <div role="tablist" aria-label={t("nav.notifications")} className="notifications-tabs">
          {tabs.map((value, index) => {
            const Icon = value === "canais" ? Mail : Clock
            return (
              <button
                key={value}
                ref={(node) => { tabRefs.current[index] = node }}
                type="button"
                role="tab"
                id={`notifications-tab-${value}`}
                aria-controls={`notifications-panel-${value}`}
                aria-selected={tab === value}
                tabIndex={tab === value ? 0 : -1}
                onClick={() => selectTab(value)}
                onKeyDown={(event) => {
                  const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
                    : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
                    : event.key === "Home" ? 0
                    : event.key === "End" ? tabs.length - 1
                    : null
                  if (next === null) return
                  event.preventDefault()
                  selectTab(tabs[next]!)
                  tabRefs.current[next]?.focus()
                }}
              >
                <Icon aria-hidden strokeWidth={1.75} />
                <span>{t(value === "canais" ? "notifications.page.tabs.channels" : "notifications.page.tabs.history")}</span>
              </button>
            )
          })}
        </div>
      </header>
      <div role="tabpanel" id={`notifications-panel-${tab}`} aria-labelledby={`notifications-tab-${tab}`}>
        {tab === "canais" ? <NotificationChannelsPanel /> : <NotificationHistoryPanel />}
      </div>
    </div>
  )
}
