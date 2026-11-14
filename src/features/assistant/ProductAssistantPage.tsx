import { useOptionalPermissions } from "@/features/users/permissions/PermissionContext"
import { CadastroShell } from "./CadastroShell"
import { useCadastroStep } from "./useCadastroStep"
import { CadastroTaxonomyStep } from "./CadastroTaxonomyStep"
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/ErrorState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ItemStatusBadge } from "@/features/assistant/ItemStatusBadge"
import { itemStatus, productSetupSteps, type SetupStepId } from "@/features/assistant/itemStatus"
import { resourceAssistantPath } from "@/features/assistant/paths"
import { CatalogProductResourceRequirements } from "@/features/catalog/components/CatalogProductResourceRequirements"
import { ProductWizardAccessStep } from "@/features/catalog/components/productWizard/ProductWizardAccessStep"
import { ProductWizardOfferStep } from "@/features/catalog/components/productWizard/ProductWizardOfferStep"
import { audienceBlocksSale, catalogMenuIsActive } from "@/features/catalog/components/productWizard/sellableChecklist"
import { useProductWizard } from "@/features/catalog/components/productWizard/useProductWizard"
import { listAdminRentalAssets, type AdminRentalAsset } from "@/features/rentals/services/scheduleService"

const STEPS = ["dados", "agenda", "fila", "regras", "precos", "publicacao"] as const
type StepId = (typeof STEPS)[number]

export function ProductAssistantPage({ cadastro = false }: { cadastro?: boolean } = {}) {
  const { step: cadastroStep, go } = useCadastroStep()
  const navigate = useNavigate()
  const [stepDirty, setStepDirty] = useState(false)
  const [stepSaving, setStepSaving] = useState(false)
  const permissions = useOptionalPermissions()
  const { id = "" } = useParams()
  const { t } = useTranslation()
  const wizard = useProductWizard(id)
  const [open, setOpen] = useState<StepId | null>("dados")
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])

  useEffect(() => {
    let active = true
    void listAdminRentalAssets().then((rows) => { if (active) setAssets(rows) }).catch(() => { if (active) setAssets([]) })
    return () => { active = false }
  }, [])

  if (wizard.loading) {
    return <Skeleton className="h-96 w-full" role="status" aria-label={t("common.loading")} />
  }
  if (wizard.error || !wizard.model) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <ErrorState message={wizard.error ?? t("apiErrors.loadCatalogProduct")} onRetry={() => void wizard.reload()} />
        <Link className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline" to="/catalogo/produtos">{t("catalog.products.title")}</Link>
      </div>
    )
  }

  const model = wizard.model
  const { product } = model
  const linkedIds = (model.requirements ?? []).flatMap((row) => row.rentalAssetId ? [row.rentalAssetId] : [])
  const linkedAssets = assets.filter((asset) => linkedIds.includes(asset.id))
  const audienceReady = (model.access?.visibility ?? product.visibility) !== "Restricted"
    || (model.access !== null && model.groups !== null && !audienceBlocksSale(model.access, model.groups))
  const agendaReady = !wizard.rentalsActive || linkedIds.length > 0
  const steps = productSetupSteps({
    name: product.name,
    isActive: product.isActive,
    price: product.price,
    audienceReady,
    agendaReady,
    menuPublished: model.menuItems === null ? null : catalogMenuIsActive(model.menuItems),
  })
  const status = itemStatus(product.isActive && model.menuItems !== null && catalogMenuIsActive(model.menuItems), steps)
  const firstMissing = (Object.keys(steps) as SetupStepId[]).find((step) => !steps[step])

  const body = (
      <div className="space-y-3">
        {STEPS.filter((step) => !cadastro || step === cadastroStep).map((step, index) => (
          <section key={step} aria-label={t(`assistant.steps.${step}`)} className="rounded-xl border bg-card p-4 text-card-foreground">
            {cadastro ? <h2 className="text-base font-semibold">{t(`assistant.steps.${step}`)}</h2> : (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{index + 1}. {t(`assistant.steps.${step}`)}</h2>
                {step !== "publicacao" ? (
                  <p className="text-sm text-muted-foreground">{steps[step] ? t("assistant.complete") : t("assistant.pending")}</p>
                ) : null}
              </div>
              <Button type="button" variant="outline" className="min-h-11" aria-expanded={open === step} onClick={() => setOpen((current) => current === step ? null : step)}>
                {open === step ? t("assistant.close") : t("assistant.edit")}
              </Button>
            </div>
            )}
            {cadastro || open === step ? (
              <div className="mt-4 space-y-4">
                {step === "dados" || step === "precos" ? (
                  <ProductWizardOfferStep product={product} readOnly={!wizard.canManage} onDirtyChange={cadastro ? setStepDirty : undefined} onSavingChange={cadastro ? setStepSaving : undefined} onSaved={() => wizard.reload()} />
                ) : null}
                {step === "agenda" ? (
                  <>
                    <CatalogProductResourceRequirements productId={product.id} readOnly={!wizard.canManage} onDirtyChange={cadastro ? setStepDirty : undefined} onSavingChange={cadastro ? setStepSaving : undefined} onSaved={() => wizard.reload()} />
                    <ResourceLinks assets={linkedAssets.length > 0 ? linkedAssets : linkedIds.map((assetId) => ({ id: assetId, name: assetId, queueEnabled: false, queueOpeningTime: null }))} />
                  </>
                ) : null}
                {step === "fila" ? <QueueSummary assets={linkedAssets} /> : null}
                {step === "regras" && model.access && model.groups ? (
                  <ProductWizardAccessStep
                    productId={product.id}
                    visibility={model.access.visibility}
                    customerIds={model.access.customerIds}
                    groupIds={model.access.groupIds}
                    groups={model.groups}
                    wizardPath={wizard.wizardPath}
                    readOnly={!wizard.canManage}
                    canSearchCustomers={wizard.canSearchCustomers}
                    onDirtyChange={cadastro ? setStepDirty : undefined}
                    onSavingChange={cadastro ? setStepSaving : undefined}
                    onSaved={() => wizard.reload()}
                  />
                ) : null}
                {step === "publicacao" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{t(`assistant.publication.${status.kind}`, { count: status.kind === "missing" ? status.count : 0 })}</p>
                    <ResourceLinks assets={linkedAssets} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ))}
      </div>
  )

  if (cadastro) return <CadastroShell title={product.name} step={cadastroStep} go={go} dirty={stepDirty} busy={wizard.busy || stepSaving} canPublish={firstMissing == null && Boolean(permissions?.can("core.module_menu.write")) && !wizard.readOnly && model.menuItems !== null} onPublish={() => void wizard.publishMenu()} onBack={() => navigate("/catalogo/produtos")}>
    {cadastroStep === "categorias" ? <CadastroTaxonomyStep onDirtyChange={setStepDirty} onSavingChange={setStepSaving} product={product} canAssign={wizard.canManage} onSaved={() => wizard.reload()} /> : body}
  </CadastroShell>

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-4 pb-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("catalog.products.title")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <ItemStatusBadge status={status} />
        </div>
        {firstMissing ? (
          <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => setOpen(firstMissing)}>{t("assistant.continue", { step: t(`assistant.steps.${firstMissing}`) })}</Button>
        ) : (
          <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={wizard.busy} onClick={() => void wizard.publishMenu()}>{t("assistant.publish")}</Button>
        )}
      </header>
      {body}
    </div>
  )
}

function ResourceLinks({ assets }: { assets: readonly { id: string; name: string }[] }) {
  const { t } = useTranslation()
  return (
    <section aria-label={t("assistant.resourceTitle")} className="space-y-2">
      <h3 className="text-sm font-semibold">{t("assistant.resourceTitle")}</h3>
      {assets.length === 0 ? <p className="text-sm text-muted-foreground">{t("assistant.audienceEmpty")}</p> : assets.map((asset) => (
        <div key={asset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <p className="text-sm font-medium">{asset.name}</p>
          <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" to={resourceAssistantPath(asset.id)}>{t("assistant.openResource")}</Link>
        </div>
      ))}
    </section>
  )
}

function QueueSummary({ assets }: { assets: readonly Pick<AdminRentalAsset, "id" | "name" | "queueEnabled" | "queueOpeningTime">[] }) {
  const { t } = useTranslation()
  if (assets.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("assistant.followsQueue")}</p>
  }
  return (
    <ul className="space-y-2">
      {assets.map((asset) => (
        <li key={asset.id} className="text-sm">
          {asset.name}: {asset.queueEnabled ? t("assistant.queueOnSummary") : t("assistant.queueOffSummary")}
          {asset.queueEnabled && asset.queueOpeningTime ? ` · ${asset.queueOpeningTime.slice(0, 5)}` : ""}
        </li>
      ))}
    </ul>
  )
}
