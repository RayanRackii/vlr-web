import { CadastroShell } from "./CadastroShell"
import { ProductPublishSuccess, ProductPublishSummary } from "./ProductPublishPanels"
import { useBreadcrumbTitle } from "@/components/layout/useBreadcrumbTitle"
import { toast } from "sonner"
import { activateCatalogProduct } from "@/features/catalog/services/catalogService"
import type { CadastroStep } from "./useCadastroStep"
import { cadastroSteps, useCadastroStep } from "./useCadastroStep"
import { CadastroTaxonomyStep } from "./CadastroTaxonomyStep"
import { useEffect, useState } from "react"
import { useOptionalPermissions } from "@/features/users/permissions/PermissionContext"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/ErrorState"
import { Skeleton } from "@/components/ui/skeleton"
import { type SetupStepId } from "@/features/assistant/itemStatus"
import { CatalogProductResourceRequirements } from "@/features/catalog/components/CatalogProductResourceRequirements"
import { ProductEditorRedirect } from "@/features/catalog/components/ProductEditorRedirect"
import { QueueSummary, ResourceLinks } from "@/features/catalog/components/ProductScheduleSection"
import { ProductWizardAccessStep } from "@/features/catalog/components/productWizard/ProductWizardAccessStep"
import { ProductWizardFilesStep } from "@/features/catalog/components/productWizard/ProductWizardFilesStep"
import { ProductWizardOfferStep } from "@/features/catalog/components/productWizard/ProductWizardOfferStep"
import { useProductWizard } from "@/features/catalog/components/productWizard/useProductWizard"
import { catalogMenuIsActive } from "@/features/catalog/components/productWizard/sellableChecklist"
import { productNotApplicableSteps, productSetupFromModel } from "@/features/catalog/lib/productSetupStatus"
import { listAdminRentalAssets, type AdminRentalAsset } from "@/features/rentals/services/scheduleService"

/** Editing an existing product lives in the product editor; this page is only the cadastro wizard. */
export function ProductAssistantPage({ cadastro = false }: { cadastro?: boolean } = {}) {
  if (!cadastro) return <ProductEditorRedirect />
  return <ProductCadastroPage />
}

function ProductCadastroPage() {
  const { step: cadastroStep, go } = useCadastroStep()
  const navigate = useNavigate()
  const permissions = useOptionalPermissions()
  const [stepDirty, setStepDirty] = useState(false)
  const [stepSaving, setStepSaving] = useState(false)
  const [justPublished, setJustPublished] = useState(false)
  const [menuFailed, setMenuFailed] = useState(false)
  const { id = "" } = useParams()
  const { t } = useTranslation()
  const wizard = useProductWizard(id)
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  useBreadcrumbTitle(wizard.model?.product.name)

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
  const { steps, status, firstMissing, linkedAssetIds: linkedIds } = productSetupFromModel(model, wizard.rentalsActive)
  const linkedAssets = assets.filter((asset) => linkedIds.includes(asset.id))
  const missingStep: SetupStepId | undefined = firstMissing
  const notApplicable = productNotApplicableSteps(product.usesSchedule, wizard.rentalsActive)

  /** Moves to a step, skipping the ones that do not apply under the freshly saved product (not the render's stale one). */
  function goSkipping(target: CadastroStep) {
    const latest = wizard.modelRef.current?.product.usesSchedule ?? product.usesSchedule
    const skipped = productNotApplicableSteps(latest, wizard.rentalsActive)
    const direction = cadastroSteps.indexOf(target) >= cadastroSteps.indexOf(cadastroStep) ? 1 : -1
    let index = cadastroSteps.indexOf(target)
    while (skipped.includes(cadastroSteps[index]) && index + direction >= 0 && index + direction < cadastroSteps.length) index += direction
    go(cadastroSteps[index])
  }

  const taxonomy = product.taxonomy
  const done: CadastroStep[] = [
    ...(Object.entries(steps) as [SetupStepId, boolean][]).filter(([, ok]) => ok).map(([id]) => id),
    ...(product.files.length > 0 ? ["arquivos" as const] : []),
    ...((taxonomy?.categories.length ?? 0) + (taxonomy?.tags.length ?? 0) > 0 ? ["categorias" as const] : []),
    ...(status.kind === "published" ? ["publicacao" as const] : []),
  ]

  /** Publicar: activates the product (the list's Ativar call) and, when it is not on the portal menu yet, publishes the menu. */
  async function publish() {
    if (!product.isActive) {
      try {
        await activateCatalogProduct(product.id)
        toast.success(t("catalog.products.toastActivated"))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("apiErrors.updateCatalogProductStatus"))
        return
      }
    }
    if (model.menuItems !== null && !catalogMenuIsActive(model.menuItems) && permissions?.can("core.module_menu.write") && !wizard.readOnly) {
      const menuOk = await wizard.publishMenu()
      setMenuFailed(!menuOk)
      if (!menuOk) return
    } else {
      await wizard.reload()
    }
    setMenuFailed(false)
    setJustPublished(true)
  }

  const visibility = model.access?.visibility ?? product.visibility ?? "Public"

  const body = (
      <div className="space-y-4">
        {cadastroStep === "dados" || cadastroStep === "precos" ? (
          <ProductWizardOfferStep product={product} mode={cadastroStep === "precos" ? "precos" : "dados"} showUsesSchedule={wizard.rentalsActive} readOnly={!wizard.canManage} onDirtyChange={setStepDirty} onSavingChange={setStepSaving} onSaved={() => wizard.reload()} />
        ) : null}
        {cadastroStep === "arquivos" ? (
          <ProductWizardFilesStep product={product} canManage={wizard.canManage} onReload={() => wizard.reload()} />
        ) : null}
        {cadastroStep === "agenda" ? (
          <CatalogProductResourceRequirements productId={product.id} readOnly={!wizard.canManage} onDirtyChange={setStepDirty} onSavingChange={setStepSaving} onSaved={() => wizard.reload()} />
        ) : null}
        {cadastroStep === "fila" ? <QueueSummary assets={linkedAssets} /> : null}
        {cadastroStep === "regras" && model.access && model.groups ? (
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
        {cadastroStep === "publicacao" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t(`assistant.publication.${status.kind}`, { count: status.kind === "missing" ? status.count : 0 })}</p>
            {menuFailed ? <p className="text-sm text-muted-foreground" role="status">{t("cadastro.published.menuFailed")}</p> : null}
            <ProductPublishSummary
              product={product}
              categoryNames={taxonomy?.categories.map((category) => category.name) ?? []}
              usesAgenda={product.usesSchedule && wizard.rentalsActive}
              resourceNames={linkedAssets.map((asset) => asset.name)}
              visibility={visibility}
              go={goSkipping}
            />
            <ResourceLinks assets={linkedAssets} />
          </div>
        ) : null}
      </div>
  )

  return <CadastroShell kind="product" title={product.name} status={status} step={cadastroStep} go={goSkipping} notApplicable={notApplicable} dirty={stepDirty} busy={wizard.busy || stepSaving} done={done} optional={["categorias", "arquivos"]} canPublish={missingStep == null && wizard.canManage && !justPublished} completed={justPublished && cadastroStep === "publicacao"} onPublish={publish} onBack={() => navigate("/catalogo/produtos")}>
    {justPublished && cadastroStep === "publicacao" ? <ProductPublishSuccess product={product} visibility={visibility} editorPath={`/catalogo/produtos/${product.id}`} /> : cadastroStep === "categorias" ? <CadastroTaxonomyStep onDirtyChange={setStepDirty} onSavingChange={setStepSaving} product={product} canAssign={wizard.canManage} onSaved={() => wizard.reload()} /> : body}
  </CadastroShell>
}
