import { useTranslation } from "react-i18next"

import { listTotalOf } from "@/lib/listTotal"

/** Small note shown when the API capped a list: the rows shown are only the newest of a larger total. */
export function CappedListNote({ rows, className }: { rows: readonly unknown[]; className?: string }) {
  const { t, i18n } = useTranslation()
  const total = listTotalOf(rows)
  if (total === null || total <= rows.length) return null
  return (
    <p role="note" className={className ?? "text-xs text-muted-foreground"}>
      {t("common.cappedList", { shown: rows.length.toLocaleString(i18n.language), total: total.toLocaleString(i18n.language) })}
    </p>
  )
}
