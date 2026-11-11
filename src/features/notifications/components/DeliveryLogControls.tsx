import { Bell, Mail, MessageCircle, Smartphone } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { CivilDateInput } from "@/components/CivilDateInput"
import { cn } from "@/lib/utils"
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
} from "@/features/catalog/schemas/catalogSchemas"
import { DELIVERY_EVENT_KEYS, deliveryEventLabel } from "@/features/notifications/lib/deliveryEventLabel"

const STATUSES: NotificationDeliveryStatus[] = ["Queued", "Sending", "Sent", "Delivered", "Failed"]
const CHANNELS: Array<{ value: NotificationChannel; icon: typeof Bell }> = [
  { value: "InApp", icon: Bell },
  { value: "Email", icon: Mail },
  { value: "WhatsApp", icon: MessageCircle },
  { value: "Sms", icon: Smartphone },
]

type DeliveryLogControlsProps = {
  status: NotificationDeliveryStatus | ""
  channel: NotificationChannel | ""
  event: string
  from: string
  to: string
  pageSize: 20 | 50
  onStatus: (value: NotificationDeliveryStatus | "") => void
  onChannel: (value: NotificationChannel | "") => void
  onEvent: (value: string) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
  onPageSize: (value: 20 | 50) => void
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function DeliveryLogControls(props: DeliveryLogControlsProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label={t("catalog.notifications.columns.status")}>
        <Chip pressed={props.status === ""} onClick={() => props.onStatus("")}>{t("catalog.notifications.filters.all")}</Chip>
        {STATUSES.map((status) => (
          <Chip key={status} pressed={props.status === status} onClick={() => props.onStatus(status)}>
            {t(`catalog.deliveryStatus.${status}`)}
          </Chip>
        ))}
      </div>
      <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label={t("catalog.notifications.columns.channel")}>
        <Chip pressed={props.channel === ""} onClick={() => props.onChannel("")}>{t("catalog.notifications.filters.all")}</Chip>
        {CHANNELS.map(({ value, icon: Icon }) => (
          <Chip key={value} pressed={props.channel === value} onClick={() => props.onChannel(value)}>
            <Icon aria-hidden className="size-3.5" />
            {t(`catalog.channels.${value}`)}
          </Chip>
        ))}
      </div>
      <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label={t("catalog.notifications.columns.event")}>
        <Chip pressed={props.event === ""} onClick={() => props.onEvent("")}>{t("catalog.notifications.filters.all")}</Chip>
        {DELIVERY_EVENT_KEYS.map((eventKey) => (
          <Chip key={eventKey} pressed={props.event === eventKey} onClick={() => props.onEvent(eventKey)}>
            {deliveryEventLabel(eventKey, t)}
          </Chip>
        ))}
      </div>
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t("catalog.notifications.filters.from")}</span>
          <CivilDateInput
            aria-label={t("catalog.notifications.filters.from")}
            locale={locale}
            value={props.from}
            onChange={props.onFrom}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t("catalog.notifications.filters.to")}</span>
          <CivilDateInput
            aria-label={t("catalog.notifications.filters.to")}
            locale={locale}
            value={props.to}
            onChange={props.onTo}
          />
        </label>
        <div className="flex gap-2" role="group" aria-label={t("catalog.notifications.filters.pageSize")}>
          {([20, 50] as const).map((size) => (
            <Chip key={size} pressed={props.pageSize === size} onClick={() => props.onPageSize(size)}>
              {size}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}
