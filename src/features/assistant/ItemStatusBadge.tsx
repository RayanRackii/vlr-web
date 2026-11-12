import { useTranslation } from "react-i18next"
import type { ItemStatus } from "./itemStatus"

const tone: Record<ItemStatus["kind"], string> = {
  published: "border-transparent bg-primary/15 text-foreground",
  draft: "border-border bg-muted text-muted-foreground",
  missing: "border-transparent bg-accent text-accent-foreground",
}

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const { t } = useTranslation()
  const label = status.kind === "missing"
    ? status.gap
      ? t(`assistant.status.gap.${status.gap}`)
      : t("assistant.status.missing", { count: status.count })
    : t(`assistant.status.${status.kind}`)
  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2 text-xs font-medium ${tone[status.kind]}`}>
      {label}
    </span>
  )
}
