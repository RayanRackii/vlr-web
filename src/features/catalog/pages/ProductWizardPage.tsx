import { useContext, useEffect, useMemo, useState, type MouseEvent } from "react"
import {
  Link,
  UNSAFE_DataRouterContext as DataRouterContext,
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/ErrorState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WizardPanelsStepper } from "@/components/ui/wizard-panels"
import { ProductWizardAccessStep } from "@/features/catalog/components/productWizard/ProductWizardAccessStep"
import { isSameTabPrimaryClick } from "@/features/catalog/components/productWizard/plainClick"
import { ProductWizardOfferStep } from "@/features/catalog/components/productWizard/ProductWizardOfferStep"
import { ProductWizardStatusStep } from "@/features/catalog/components/productWizard/ProductWizardStatusStep"
import { useProductWizard } from "@/features/catalog/components/productWizard/useProductWizard"
import {
  moveProductWizardStep,
  PRODUCT_WIZARD_STEPS,
  productWizardPath,
  productWizardStepFromQuery,
  type ProductWizardStepId,
} from "@/features/catalog/components/productWizard/wizardSteps"
import { CatalogProductResourceRequirements } from "@/features/catalog/components/CatalogProductResourceRequirements"
import type { SellableChecklistItem } from "@/features/catalog/components/productWizard/sellableChecklist"

/**
 * Same confirm-on-block behavior as the product editor's leave guard.
 * Saving blocks the navigation without a second prompt.
 */
function WizardLeaveGuard({ dirty, saving }: { dirty: boolean; saving: boolean }) {
  const { t } = useTranslation()
  const message = t("fullPage.leaveConfirm")
  const blocker = useBlocker(dirty || saving)
  useEffect(() => {
    if (blocker.state !== "blocked") {
      return
    }
    if (saving) {
      blocker.reset()
      return
    }
    if (window.confirm(message)) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker, message, saving])
  return null
}

export function ProductWizardPage() {
  const { id = "" } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const step = productWizardStepFromQuery(params.get("passo"))
  const wizard = useProductWizard(id)
  const [stepDirty, setStepDirty] = useState(false)
  const [stepSaving, setStepSaving] = useState(false)
  const hasDataRouter = useContext(DataRouterContext) != null
  const stepIndex = PRODUCT_WIZARD_STEPS.indexOf(step)

  useEffect(() => {
    if (!stepDirty && !stepSaving) {
      return
    }
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [stepDirty, stepSaving])
  const steps = useMemo(
    () => PRODUCT_WIZARD_STEPS.map((wizardStep) => ({
      id: wizardStep,
      label: t(`catalog.productWizard.steps.${wizardStep}`),
    })),
    [t],
  )

  function allowLeaveAttempt(): boolean {
    if (stepSaving) {
      return false
    }
    if (!hasDataRouter && stepDirty) {
      return window.confirm(t("fullPage.leaveConfirm"))
    }
    return true
  }

  function guardLink(event: MouseEvent<HTMLAnchorElement>) {
    if (!isSameTabPrimaryClick(event)) {
      return
    }
    if (!allowLeaveAttempt()) {
      event.preventDefault()
    }
  }

  function go(next: ProductWizardStepId) {
    if (stepSaving || next === step || !allowLeaveAttempt()) {
      return
    }
    const nextParams = new URLSearchParams(params)
    if (next === "status") {
      nextParams.delete("passo")
    } else {
      nextParams.set("passo", next)
    }
    setParams(nextParams, { replace: true })
  }

  function finish() {
    if (stepSaving || !allowLeaveAttempt()) {
      return
    }
    void navigate("/catalogo/produtos")
  }

  function onChecklistAction(item: SellableChecklistItem) {
    if (stepSaving) {
      return
    }
    if (item.action.kind === "createMenu") {
      void wizard.publishMenu()
      return
    }
    if (item.action.kind === "step") {
      go(item.action.step)
      return
    }
    if (item.action.kind === "link") {
      if (!allowLeaveAttempt()) {
        return
      }
      void navigate(item.action.href)
    }
  }

  if (wizard.loading) {
    return <Skeleton className="h-96 w-full" role="status" aria-label={t("common.loading")} />
  }

  if (wizard.error || !wizard.model) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <ErrorState message={wizard.error ?? t("catalog.productWizard.notFound")} onRetry={() => void wizard.reload()} />
        <Link className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline" to="/catalogo/produtos">
          {t("catalog.products.title")}
        </Link>
      </div>
    )
  }

  const { product } = wizard.model

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl pb-[max(1rem,env(safe-area-inset-bottom))]">
      {hasDataRouter ? <WizardLeaveGuard dirty={stepDirty} saving={stepSaving} /> : null}
      <nav className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-label={t("catalog.productWizard.breadcrumbLabel")}>
        <Link className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline" to="/catalogo/produtos" onClick={guardLink}>
          {t("catalog.products.title")}
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline" to={`/catalogo/produtos/${encodeURIComponent(product.id)}`} onClick={guardLink}>
          {product.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{t("catalog.productWizard.breadcrumb")}</span>
      </nav>
      <header className="mb-4 space-y-1">
        <p className="text-sm font-medium text-primary">{t("catalog.products.title")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("catalog.productWizard.title")}</h1>
        <p className="text-sm text-muted-foreground">{product.name}. {t("catalog.productWizard.description")}</p>
      </header>

      <div className="hidden sm:block">
        <WizardPanelsStepper
          steps={steps}
          currentIndex={stepIndex}
          selection="any"
          connectors={false}
          ariaLabel={t("catalog.productWizard.stepperLabel")}
          onStepClick={stepSaving ? undefined : (index) => {
            const next = PRODUCT_WIZARD_STEPS[index]
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
          ariaLabel={t("catalog.productWizard.stepperLabel")}
          onStepClick={stepSaving ? undefined : (index) => {
            const next = PRODUCT_WIZARD_STEPS[index]
            if (next) go(next)
          }}
        />
      </div>

      <div className="mt-4">
        {step === "status" ? (
          <ProductWizardStatusStep
            summary={wizard.summary}
            items={wizard.checklist}
            resourceCapability={wizard.model.resourceCapability}
            busy={wizard.busy}
            onAction={onChecklistAction}
          />
        ) : null}
        {step === "offer" ? (
          <ProductWizardOfferStep
            product={product}
            readOnly={!wizard.canManage}
            onDirtyChange={setStepDirty}
            onSavingChange={setStepSaving}
            onSaved={() => wizard.reload()}
          />
        ) : null}
        {step === "access" && wizard.model.access && wizard.model.groups ? (
          <ProductWizardAccessStep
            productId={product.id}
            visibility={wizard.model.access.visibility}
            customerIds={wizard.model.access.customerIds}
            groupIds={wizard.model.access.groupIds}
            groups={wizard.model.groups}
            wizardPath={productWizardPath(product.id, "access")}
            readOnly={!wizard.canManage}
            canSearchCustomers={wizard.canSearchCustomers}
            onDirtyChange={setStepDirty}
            onSavingChange={setStepSaving}
            beforeNavigate={allowLeaveAttempt}
            onSaved={() => wizard.reload()}
          />
        ) : null}
        {step === "access" && (!wizard.model.access || !wizard.model.groups) ? (
          <p className="text-sm text-muted-foreground">{t("catalog.productWizard.details.audience.unavailable")}</p>
        ) : null}
        {step === "resource" ? (
          wizard.rentalsActive ? (
            <div className="mx-auto w-full max-w-xl space-y-3">
              <div>
                <h2 className="text-lg font-semibold">{t("catalog.productWizard.steps.resource")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("catalog.productWizard.resourceHint")}</p>
              </div>
              {wizard.model.resourceCapability === "inactive" ? (
                <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                  {t("catalog.productWizard.details.resource.inactiveModule")}
                </p>
              ) : (
                <CatalogProductResourceRequirements
                  productId={product.id}
                  readOnly={!wizard.canManage}
                  onDirtyChange={setStepDirty}
                  onSavingChange={setStepSaving}
                  onSaved={() => wizard.reload()}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("catalog.productWizard.details.resource.notApplicable")}</p>
          )
        ) : null}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={step === "status" || wizard.busy || stepSaving}
          onClick={() => go(moveProductWizardStep(step, -1))}
        >
          {t("catalog.productWizard.back")}
        </Button>
        {step === "resource" ? (
          <Button type="button" className="min-h-11 w-full sm:w-auto" aria-busy={stepSaving} disabled={wizard.busy || stepSaving} onClick={finish}>
            {stepSaving ? t("common.saveStatus.saving") : t("catalog.productWizard.finish")}
          </Button>
        ) : (
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            aria-busy={stepSaving}
            disabled={wizard.busy || stepSaving}
            onClick={() => go(moveProductWizardStep(step, 1))}
          >
            {stepSaving ? t("common.saveStatus.saving") : t("catalog.productWizard.next")}
          </Button>
        )}
      </div>
    </div>
  )
}
