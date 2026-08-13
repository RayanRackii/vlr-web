import { Tags } from "lucide-react"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import type { OccupancyKind } from "@/features/rentals/services/scheduleService"

type OccupancyKindsTabProps = {
  kinds: readonly OccupancyKind[]
  loading: boolean
  busy: boolean
  readOnly: boolean
  onAdd: () => void
  onEdit: (kind: OccupancyKind) => void
}

export function OccupancyKindsTab({
  kinds,
  loading,
  busy,
  readOnly,
  onAdd,
  onEdit,
}: OccupancyKindsTabProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">
          {t("rentals.schedule.kinds.description")}
        </p>
        <Button
          type="button"
          size="sm"
          disabled={busy || readOnly}
          onClick={onAdd}
        >
          {t("rentals.schedule.kinds.saveCreate")}
        </Button>
      </div>

      {loading ? (
        <PageContentSkeleton rows={3} />
      ) : kinds.length === 0 ? (
        <ScheduleEmptyState
          icon={Tags}
          title={t("rentals.schedule.kinds.emptyTitle")}
          description={t("rentals.schedule.kinds.empty")}
          actionLabel={t("rentals.schedule.kinds.saveCreate")}
          actionDisabled={busy || readOnly}
          onAction={onAdd}
        />
      ) : (
        <ul className="space-y-2">
          {kinds.map((kind) => {
            const accent = kind.colorHex?.trim() || undefined
            return (
              <li
                key={kind.id}
                className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                style={
                  accent
                    ? { borderLeftWidth: 4, borderLeftColor: accent }
                    : undefined
                }
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {kind.label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {kind.key}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {kind.isBookableByCustomer
                      ? t("rentals.schedule.kinds.bookable")
                      : t("rentals.schedule.kinds.notBookable")}
                    {" · "}
                    {kind.isActive
                      ? t("rentals.schedule.active")
                      : t("rentals.schedule.inactive")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || readOnly}
                  onClick={() => {
                    onEdit(kind)
                  }}
                >
                  {t("common.edit")}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
