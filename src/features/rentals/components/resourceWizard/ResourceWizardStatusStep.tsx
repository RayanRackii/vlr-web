import { AlertCircle, CheckCircle2, Circle, Minus } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import type { ChecklistAsset, ChecklistItem, BookableSummary } from "@/features/rentals/components/resourceWizard/bookableChecklist"

type ResourceWizardStatusStepProps = {
  summary: BookableSummary
  items: readonly ChecklistItem[]
  asset: ChecklistAsset
  busy: boolean
  onAction: (item: ChecklistItem) => void
}

function actionLabel(
  item: ChecklistItem,
  t: (key: string) => string,
): string | null {
  if (item.action.kind === "none") {
    return null
  }
  if (item.action.kind === "createMenu") {
    return t("rentals.resourceWizard.actions.createMenu")
  }
  if (item.action.kind === "createKind") {
    return t("rentals.resourceWizard.actions.createKind")
  }
  if (item.action.kind === "step") {
    return t(item.status === "done"
      ? "rentals.resourceWizard.actions.reviewStep"
      : "rentals.resourceWizard.actions.openStep")
  }
  if (item.id === "portalMenu") {
    return t("rentals.resourceWizard.actions.openMenu")
  }
  if (item.id === "occupancyKinds") {
    return t("rentals.resourceWizard.actions.openKinds")
  }
  return t("rentals.resourceWizard.actions.reviewStep")
}

function detailKey(item: ChecklistItem, asset: ChecklistAsset): string {
  if (item.id === "queue" && item.status === "done") {
    return asset.queueEnabled
      ? "rentals.resourceWizard.details.queue.on"
      : "rentals.resourceWizard.details.queue.off"
  }
  if (item.id === "queue") {
    return `rentals.resourceWizard.details.queue.${item.status === "missing" ? "missing" : "notApplicable"}`
  }
  return `rentals.resourceWizard.details.${item.id}.${item.status}`
}

export function ResourceWizardStatusStep({
  summary,
  items,
  asset,
  busy,
  onAction,
}: ResourceWizardStatusStepProps) {
  const { t } = useTranslation()

  return (
    <section className="space-y-4" aria-labelledby="wizard-status-title">
      <div>
        <h2 id="wizard-status-title" className="text-lg font-semibold">
          {t("rentals.resourceWizard.checklistTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground" role="status">
          {t(`rentals.resourceWizard.summary.${summary}`)}
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((entry) => {
          const label = actionLabel(entry, t)
          const Icon = entry.status === "done"
            ? CheckCircle2
            : entry.status === "unavailable"
              ? AlertCircle
              : entry.status === "notApplicable"
                ? Minus
                : Circle
          return (
            <li key={entry.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 gap-3">
                <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-medium">{t(`rentals.resourceWizard.items.${entry.id}`)}</p>
                  <p className="text-sm text-muted-foreground">{t(detailKey(entry, asset))}</p>
                  <p className="text-xs font-medium text-foreground">
                    {t(`rentals.resourceWizard.statusLabel.${entry.status}`)}
                  </p>
                </div>
              </div>
              {label ? (
                <Button
                  type="button"
                  variant={entry.status === "missing" ? "default" : "outline"}
                  className="min-h-11 w-full sm:w-auto"
                  disabled={busy}
                  onClick={() => onAction(entry)}
                >
                  {label}
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
