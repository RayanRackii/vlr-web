import { useOptionalPermissions } from "@/features/users/permissions/PermissionContext"
import { CadastroShell } from "./CadastroShell"
import { useCadastroStep } from "./useCadastroStep"
import { CadastroTaxonomyStep } from "./CadastroTaxonomyStep"
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { type SetupStepId } from "@/features/assistant/itemStatus"
import { CatalogProductResourceRequirements } from "@/features/catalog/components/CatalogProductResourceRequirements"
import { ProductEditorRedirect } from "@/features/catalog/components/ProductEditorRedirect"
import { QueueSummary, ResourceLinks } from "@/features/catalog/components/ProductScheduleSection"
import { ProductWizardAccessStep } from "@/features/catalog/components/productWizard/ProductWizardAccessStep"
import { ProductWizardOfferStep } from "@/features/catalog/components/productWizard/ProductWizardOfferStep"
import { useProductWizard } from "@/features/catalog/components/productWizard/useProductWizard"
import { productSetupFromModel } from "@/features/catalog/lib/productSetupStatus"
import { listAdminRentalAssets, type AdminRentalAsset } from "@/features/rentals/services/scheduleService"

const STEPS = ["dados", "agenda", "fila", "regras", "precos", "publicacao"] as const

/** Editing an existing product lives in the product editor; this page is only the cadastro wizard. */
export function ProductAssistantPage({ cadastro = false }: { cadastro?: boolean } = {}) {
  if (!cadastro) return <ProductEditorRedirect />
  return <ProductCadastroPage />
}

function ProductCadastroPage() {
  const { step: cadastroStep, go } = useCadastroStep()
  const navigate = useNavigate()
  const [stepDirty, setStepDirty] = useState(false)
  const [stepSaving, setStepSaving] = useState(false)
  const permissions = useOptionalPermissions()
  const { id = "" } = useParams()
  const { t } = useTranslation()
  const wizard = useProductWizard(id)
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
  const { status, firstMissing, linkedAssetIds: linkedIds } = productSetupFromModel(model, wizard.rentalsActive)
  const linkedAssets = assets.filter((asset) => linkedIds.includes(asset.id))
  const missingStep: SetupStepId | undefined = firstMissing

  const body = (
      <div className="space-y-3">
        {STEPS.filter((step) => step === cadastroStep).map((step) => (
          <section key={step} aria-label={t(`assistant.steps.${step}`)} className="rounded-xl border bg-card p-4 text-card-foreground">
            <h2 className="text-base font-semibold">{t(`assistant.steps.${step}`)}</h2>
            <div className="mt-4 space-y-4">
                {step === "dados" || step === "precos" ? (
                  <ProductWizardOfferStep product={product} readOnly={!wizard.canManage} onDirtyChange={setStepDirty} onSavingChange={setStepSaving} onSaved={() => wizard.reload()} />
                ) : null}
                {step === "agenda" ? (
                  <>
                    <CatalogProductResourceRequirements productId={product.id} readOnly={!wizard.canManage} onDirtyChange={setStepDirty} onSavingChange={setStepSaving} onSaved={() => wizard.reload()} />
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
                    onDirtyChange={setStepDirty}
                    onSavingChange={setStepSaving}
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
          </section>
        ))}
      </div>
  )

  return <CadastroShell title={product.name} step={cadastroStep} go={go} dirty={stepDirty} busy={wizard.busy || stepSaving} canPublish={missingStep == null && Boolean(permissions?.can("core.module_menu.write")) && !wizard.readOnly && model.menuItems !== null} onPublish={() => void wizard.publishMenu()} onBack={() => navigate("/catalogo/produtos")}>
    {cadastroStep === "categorias" ? <CadastroTaxonomyStep onDirtyChange={setStepDirty} onSavingChange={setStepSaving} product={product} canAssign={wizard.canManage} onSaved={() => wizard.reload()} /> : body}
  </CadastroShell>
}
