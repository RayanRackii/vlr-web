import { AlertCircle, CheckCircle2, Circle, Minus } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import type { ResourceCapability, SellableChecklistItem, SellableSummary } from "@/features/catalog/components/productWizard/sellableChecklist"

type ProductWizardStatusStepProps = {
  summary: SellableSummary
  items: readonly SellableChecklistItem[]
  resourceCapability: ResourceCapability
  busy: boolean
  onAction: (item: SellableChecklistItem) => void
}

function actionLabel(item: SellableChecklistItem, t: (key: string) => string): string | null {
  if (item.action.kind === "none") {
    return null
  }
  if (item.action.kind === "createMenu") {
    return t("catalog.productWizard.actions.createMenu")
  }
  if (item.action.kind === "link" && item.id === "portalMenu") {
    return t("catalog.productWizard.actions.openMenu")
  }
  if (item.action.kind === "link" && item.id === "audience") {
    return t("catalog.productWizard.actions.openGroup")
  }
  return t(item.status === "done"
    ? "catalog.productWizard.actions.reviewStep"
    : "catalog.productWizard.actions.openStep")
}

function detailKey(item: SellableChecklistItem, resourceCapability: ResourceCapability): string {
  if (item.id === "resource" && item.status === "unavailable" && resourceCapability === "inactive") {
    return "catalog.productWizard.details.resource.inactiveModule"
  }
  if (item.id === "resource" && item.status === "done") {
    return item.blocksSale
      ? "catalog.productWizard.details.resource.done"
      : "catalog.productWizard.details.resource.none"
  }
  return `catalog.productWizard.details.${item.id}.${item.status}`
}

export function ProductWizardStatusStep({
  summary,
  items,
  resourceCapability,
  busy,
  onAction,
}: ProductWizardStatusStepProps) {
  const { t } = useTranslation()

  return (
    <section className="space-y-4" aria-labelledby="product-wizard-status-title">
      <div>
        <h2 id="product-wizard-status-title" className="text-lg font-semibold">
          {t("catalog.productWizard.checklistTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground" role="status">
          {t(`catalog.productWizard.summary.${summary}`)}
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
                  <p className="font-medium">{t(`catalog.productWizard.items.${entry.id}`)}</p>
                  <p className="text-sm text-muted-foreground">{t(detailKey(entry, resourceCapability))}</p>
                  <p className="text-xs font-medium text-foreground">
                    {t(`catalog.productWizard.statusLabel.${entry.status}`)}
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
