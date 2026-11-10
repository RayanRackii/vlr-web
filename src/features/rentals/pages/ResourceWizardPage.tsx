import { useMemo } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/ErrorState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WizardPanelsStepper } from "@/components/ui/wizard-panels"
import { ResourceWizardAgendaStep } from "@/features/rentals/components/resourceWizard/ResourceWizardAgendaStep"
import { ResourceWizardPricesStep } from "@/features/rentals/components/resourceWizard/ResourceWizardPricesStep"
import { ResourceWizardRulesStep } from "@/features/rentals/components/resourceWizard/ResourceWizardRulesStep"
import { menuCoversAsset } from "@/features/rentals/components/resourceWizard/bookableChecklist"
import { ResourceWizardStatusStep } from "@/features/rentals/components/resourceWizard/ResourceWizardStatusStep"
import { ItemStatusBadge } from "@/features/assistant/ItemStatusBadge"
import { resourceItemStatus } from "@/features/assistant/itemStatus"
import type { ChecklistItem } from "@/features/rentals/components/resourceWizard/bookableChecklist"
import { useResourceWizard } from "@/features/rentals/components/resourceWizard/useResourceWizard"
import {
  moveResourceWizardStep,
  RESOURCE_WIZARD_STEPS,
  resourceWizardStepFromQuery,
  type ResourceWizardStepId,
} from "@/features/rentals/components/resourceWizard/wizardSteps"

export function ResourceWizardPage() {
  const { id = "" } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const step = resourceWizardStepFromQuery(params.get("passo"))
  const wizard = useResourceWizard(id)
  const stepIndex = RESOURCE_WIZARD_STEPS.indexOf(step)
  const steps = useMemo(
    () => RESOURCE_WIZARD_STEPS.map((wizardStep) => ({
      id: wizardStep,
      label: t(`rentals.resourceWizard.steps.${wizardStep}`),
    })),
    [t],
  )

  function go(next: ResourceWizardStepId) {
    const nextParams = new URLSearchParams(params)
    if (next === "status") {
      nextParams.delete("passo")
    } else {
      nextParams.set("passo", next)
    }
    setParams(nextParams, { replace: true })
  }

  function onChecklistAction(item: ChecklistItem) {
    if (item.action.kind === "createMenu") {
      wizard.publishMenu()
      return
    }
    if (item.action.kind === "createKind") {
      wizard.createKind()
      return
    }
    if (item.action.kind === "step") {
      go(item.action.step)
      return
    }
    if (item.action.kind === "link") {
      void navigate(item.action.href)
    }
  }

  if (wizard.loading) {
    return <Skeleton className="h-96 w-full" role="status" aria-label={t("common.loading")} />
  }

  if (wizard.error || !wizard.model) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <ErrorState message={wizard.error ?? t("rentals.resourceWizard.notFound")} onRetry={() => void wizard.reload()} />
        <Link className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline" to="/configuracoes/recursos">
          {t("rentals.resources.title")}
        </Link>
      </div>
    )
  }

  const { asset } = wizard.model

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl pb-[max(1rem,env(safe-area-inset-bottom))]">
      <nav className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-label={t("rentals.resources.editor.breadcrumb")}>
        <Link className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline" to="/configuracoes/recursos">
          {t("rentals.resources.title")}
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline" to={`/configuracoes/recursos/${encodeURIComponent(asset.id)}`}>
          {asset.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{t("rentals.resourceWizard.breadcrumb")}</span>
      </nav>
      <header className="mb-4 space-y-1">
        <p className="text-sm font-medium text-primary">{t("rentals.resources.eyebrow")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("rentals.resourceWizard.title")}</h1>
          <ItemStatusBadge status={resourceItemStatus({
            name: asset.name,
            isActive: asset.isActive,
            type: asset.type,
            schedulePolicy: asset.schedulePolicy,
            openTime: asset.openTime,
            closeTime: asset.closeTime,
            queueEnabled: asset.queueEnabled,
            queueOpeningTime: asset.queueOpeningTime,
            allowedDurationMinutes: asset.allowedDurationMinutes,
            cancelCutoffHours: asset.cancelCutoffHours,
            menuPublished: wizard.model.menuItems === null ? null : wizard.model.menuItems.some((item) => menuCoversAsset(item, asset.id)),
            hasActiveTemplate: (wizard.model.templates ?? []).some((template) => template.isActive),
            hasPrice: (wizard.model.prices ?? []).some((price) => price.pricePerHour > 0),
          })} />
        </div>
        <p className="text-sm text-muted-foreground">{asset.name}. {t("rentals.resourceWizard.description")}</p>
      </header>

      <div className="hidden sm:block">
        <WizardPanelsStepper
          steps={steps}
          currentIndex={stepIndex}
          selection="any"
          connectors={false}
          ariaLabel={t("rentals.resourceWizard.stepperLabel")}
          onStepClick={(index) => {
            const next = RESOURCE_WIZARD_STEPS[index]
            if (next) go(next)
          }}
        />
      </div>
      <div className="sm:hidden">
        <WizardPanelsStepper
          variant="chips"
          steps={steps}
          currentIndex={stepIndex}
          selection="any"
          ariaLabel={t("rentals.resourceWizard.stepperLabel")}
          onStepClick={(index) => {
            const next = RESOURCE_WIZARD_STEPS[index]
            if (next) go(next)
          }}
        />
      </div>

      <div className="mt-4">
        {step === "status" ? (
          <ResourceWizardStatusStep
            summary={wizard.summary}
            items={wizard.checklist}
            asset={asset}
            busy={wizard.busy}
            onAction={onChecklistAction}
          />
        ) : null}
        {step === "rules" ? (
          <ResourceWizardRulesStep
            asset={asset}
            wizardPath={wizard.wizardPath}
            canRead={wizard.access.scheduleRead}
            templates={wizard.model.templates ?? []}
            kinds={wizard.model.kinds ?? []}
            busy={wizard.busy}
            busyAction={wizard.busyAction}
            readOnly={!wizard.access.scheduleWrite}
            onSavePolicy={wizard.savePolicy}
            onSeed={wizard.seedTemplates}
          />
        ) : null}
        {step === "prices" ? (
          <ResourceWizardPricesStep
            asset={asset}
            prices={wizard.model.prices}
            canReadPricing={wizard.access.pricingRead}
            canWritePricing={wizard.access.pricingWrite}
            canReplacePricing={wizard.access.pricingReplace}
            canWriteAsset={wizard.access.assetWrite}
            busy={wizard.busy}
            onSavePrices={wizard.savePrices}
            onSaveQueue={wizard.saveQueue}
          />
        ) : null}
        {step === "agenda" ? (
          <ResourceWizardAgendaStep
            asset={asset}
            canReadReservations={wizard.access.reservationsRead}
            onOpenPrices={() => go("prices")}
          />
        ) : null}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={step === "status" || wizard.busy}
          onClick={() => go(moveResourceWizardStep(step, -1))}
        >
          {t("rentals.resourceWizard.back")}
        </Button>
        {step === "agenda" ? (
          <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => void navigate("/configuracoes/recursos")}>
            {t("rentals.resourceWizard.finish")}
          </Button>
        ) : (
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={wizard.busy}
            onClick={() => go(moveResourceWizardStep(step, 1))}
          >
            {t("rentals.resourceWizard.next")}
          </Button>
        )}
      </div>
    </div>
  )
}
