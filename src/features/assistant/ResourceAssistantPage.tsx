import { ResourceCadastroDadosStep } from "./ResourceCadastroDadosStep"
import { CadastroShell } from "./CadastroShell"
import { useCadastroStep } from "./useCadastroStep"
import { CadastroTaxonomyStep } from "./CadastroTaxonomyStep"
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ErrorState } from "@/components/ErrorState"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ItemStatusBadge } from "@/features/assistant/ItemStatusBadge"
import { itemStatus, resourceSetupSteps, statusFromServer, type ItemStatus, type SetupStepId } from "@/features/assistant/itemStatus"
import { getCatalogProductResourceRequirements, listCatalogProducts } from "@/features/catalog/services/catalogService"
import type { CatalogProduct } from "@/features/catalog/schemas/catalogSchemas"
import { productWizardPath } from "@/features/catalog/components/productWizard/wizardSteps"
import { productAssistantPath } from "@/features/assistant/paths"
import { menuCoversAsset } from "@/features/rentals/components/resourceWizard/bookableChecklist"
import { getSetupStatus } from "@/features/rentals/services/setupStatusService"
import { setDirectRental } from "@/features/rentals/services/scheduleService"
import { ResourceWizardPricesStep } from "@/features/rentals/components/resourceWizard/ResourceWizardPricesStep"
import { ResourceWizardRulesStep } from "@/features/rentals/components/resourceWizard/ResourceWizardRulesStep"
import { useResourceWizard } from "@/features/rentals/components/resourceWizard/useResourceWizard"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"

const STEPS = ["dados", "agenda", "fila", "regras", "precos", "publicacao"] as const
type AssistantStepId = (typeof STEPS)[number]
const DURATIONS = [30, 60, 120, 240, 480]
const CUTOFFS = [2, 24, 48]

function parseDurations(value: string | null | undefined): number[] {
  return (value ?? "").split(",").map((part) => Number(part.trim())).filter((part) => Number.isInteger(part) && part > 0)
}

export function ResourceAssistantPage({ cadastro = false }: { cadastro?: boolean } = {}) {
  const { step: cadastroStep, go } = useCadastroStep()
  const navigate = useNavigate()
  const [stepDirty, setStepDirty] = useState(false)
  const [stepSaving, setStepSaving] = useState(false)
  const { id = "" } = useParams()
  const { t } = useTranslation()
  const wizard = useResourceWizard(id)
  const [open, setOpen] = useState<AssistantStepId | null>("dados")
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [serverStatus, setServerStatus] = useState<ItemStatus | null>(null)

  useEffect(() => {
    let active = true
    void listCatalogProducts().then(async (catalog) => {
      const matches: CatalogProduct[] = []
      for (const product of catalog) {
        try {
          const data = await getCatalogProductResourceRequirements(product.id)
          if (data.requirements.some((row) => row.rentalAssetId === id)) matches.push(product)
        } catch {
          // A product that cannot be read does not belong in this list.
        }
      }
      if (active) setProducts(matches)
    }).catch(() => { if (active) setProducts([]) })
    return () => { active = false }
  }, [id])

  useEffect(() => {
    let active = true
    void getSetupStatus().then((status) => {
      const row = status.resources.find((item) => item.id === id)
      if (active) setServerStatus(row ? statusFromServer(row.state, row.missing) : null)
    }).catch(() => { if (active) setServerStatus(null) })
    return () => { active = false }
  }, [id])

  if (wizard.loading) {
    return <Skeleton className="h-96 w-full" role="status" aria-label={t("common.loading")} />
  }
  if (wizard.error || !wizard.model) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <ErrorState message={wizard.error ?? t("rentals.resourceWizard.notFound")} onRetry={() => void wizard.reload()} />
        <Link className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline" to="/configuracoes/recursos">{t("rentals.resources.title")}</Link>
      </div>
    )
  }

  const model = wizard.model
  const { asset } = model
  const steps = resourceSetupSteps({
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
    menuPublished: model.menuItems === null ? null : model.menuItems.some((item) => menuCoversAsset(item, asset.id)),
    hasActiveTemplate: (model.templates ?? []).some((template) => template.isActive),
    hasPrice: (model.prices ?? []).some((price) => price.pricePerHour > 0),
    directRental: asset.directRental !== false,
    hasPricedOffer: products.some((product) => product.isActive && (product.price ?? 0) > 0),
  })
  const status = itemStatus(asset.isActive && model.menuItems !== null && model.menuItems.some((item) => menuCoversAsset(item, asset.id)), steps)
  const firstMissing = (Object.keys(steps) as SetupStepId[]).find((step) => !steps[step])

  function toggle(step: AssistantStepId) {
    setOpen((current) => current === step ? null : step)
  }

  function currentPolicy() {
    return {
      schedulePolicy: asset.schedulePolicy,
      openTime: asset.openTime,
      closeTime: asset.closeTime,
      allowedDurationMinutes: asset.allowedDurationMinutes,
    }
  }

  function saveDurations(next: number[]) {
    void wizard.savePolicy({
      ...currentPolicy(),
      allowedDurationMinutes: next.length > 0 ? next.join(",") : null,
    })
  }

  function saveTerms(patch: { minimumBookingLeadMinutes?: number | null; depositPercent?: number | null }) {
    void wizard.savePolicy({ ...currentPolicy(), ...patch })
  }

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
              <Button type="button" variant="outline" className="min-h-11" aria-expanded={open === step} onClick={() => toggle(step)}>
                {open === step ? t("assistant.close") : t("assistant.edit")}
              </Button>
            </div>
            )}
            {cadastro || open === step ? (
              <div className="mt-4">
                {step === "dados" ? (cadastro ? <ResourceCadastroDadosStep name={asset.name} busy={wizard.busy} readOnly={!wizard.access.assetWrite} onSave={wizard.saveFields} onDirtyChange={setStepDirty} /> :
                  <form className="space-y-3" onSubmit={(event) => {
                    event.preventDefault()
                    const next = new FormData(event.currentTarget).get("name")
                    void wizard.saveFields({ name: typeof next === "string" ? next : "" })
                  }}>
                    <label className="block space-y-1 text-sm font-medium">
                      {t("assistant.name")}
                      <Input key={asset.name} name="name" className="min-h-11" defaultValue={asset.name} disabled={cadastro && !wizard.access.assetWrite} required />
                    </label>
                    <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={wizard.busy || (cadastro && !wizard.access.assetWrite)}>{t("assistant.saveStep")}</Button>
                  </form>
                ) : null}
                {step === "agenda" ? (
                  <ResourceWizardRulesStep
                    asset={asset}
                    wizardPath={wizard.wizardPath}
                    canRead={wizard.access.scheduleRead}
                    templates={model.templates ?? []}
                    kinds={model.kinds ?? []}
                    busy={wizard.busy}
                    busyAction={wizard.busyAction}
                    readOnly={!wizard.access.scheduleWrite}
                    onSavePolicy={wizard.savePolicy}
                    onSeed={wizard.seedTemplates}
                  />
                ) : null}
                {step === "fila" ? <QueueStep asset={asset} busy={wizard.busy} canWrite={wizard.access.assetWrite} onSave={wizard.saveQueue} /> : null}
                {step === "regras" ? (
                  <RulesStep
                    asset={asset}
                    busy={wizard.busy || (cadastro && !wizard.access.assetWrite)}
                    products={products}
                    onDirtyChange={cadastro ? setStepDirty : undefined}
                    onDurations={saveDurations}
                    onCutoff={(hours) => void wizard.saveFields(hours === null
                      ? { cancelCutoffMode: "inherit", cancelCutoffHours: "" }
                      : hours === 0
                        ? { cancelCutoffMode: "none", cancelCutoffHours: "0" }
                        : { cancelCutoffMode: "hours", cancelCutoffHours: String(hours) })}
                    onLead={(minutes) => saveTerms({ minimumBookingLeadMinutes: minutes })}
                    onDeposit={(percent) => saveTerms({ depositPercent: percent })}
                  />
                ) : null}
                {step === "precos" ? (
                  <div className="space-y-4">
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">{t("rentals.resources.directRentalOn")}</legend>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("rentals.resources.directRentalOn")}>
                      <Button type="button" variant={asset.directRental !== false ? "default" : "outline"} aria-pressed={asset.directRental !== false} disabled={!wizard.access.assetWrite || wizard.busy} onClick={() => { void setDirectRental(asset.id, true).then(() => wizard.reload()).catch((error: unknown) => toast.error(error instanceof Error ? error.message : t("rentals.resources.errors.save"))) }}>{t("rentals.resources.directRentalOn")}</Button>
                      <Button type="button" variant={asset.directRental === false ? "default" : "outline"} aria-pressed={asset.directRental === false} disabled={!wizard.access.assetWrite || wizard.busy} onClick={() => { void setDirectRental(asset.id, false).then(() => wizard.reload()).catch((error: unknown) => toast.error(error instanceof Error ? error.message : t("rentals.resources.errors.save"))) }}>{t("rentals.resources.directRentalOff")}</Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{t("rentals.resources.directRentalHelp")}</p>
                  </fieldset>
                  <ResourceWizardPricesStep
                    asset={asset}
                    prices={model.prices}
                    canReadPricing={wizard.access.pricingRead}
                    canWritePricing={wizard.access.pricingWrite}
                    canReplacePricing={wizard.access.pricingReplace}
                    canWriteAsset={wizard.access.assetWrite}
                    busy={wizard.busy}
                    showQueue={false}
                    onSavePrices={wizard.savePrices}
                    onSaveQueue={wizard.saveQueue}
                    onDirtyChange={cadastro ? setStepDirty : undefined}
                  />
                  </div>
                ) : null}
                {step === "publicacao" ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t(`assistant.publication.${status.kind}`, { count: status.kind === "missing" ? status.count : 0 })}</p>
                    <section aria-label={t("assistant.productsTitle")} className="space-y-2">
                      <h3 className="text-sm font-semibold">{t("assistant.productsTitle")}</h3>
                      {products.length === 0 ? <p className="text-sm text-muted-foreground">{t("assistant.audienceEmpty")}</p> : products.map((product) => (
                        <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">{product.visibility === "Restricted" ? t("assistant.audienceRestricted") : t("assistant.audiencePublic")}</p>
                          </div>
                          <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" to={productAssistantPath(product.id)}>{t("assistant.openProduct")}</Link>
                          <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" to={productWizardPath(product.id, "access")}>{t("assistant.editAudience")}</Link>
                        </div>
                      ))}
                    </section>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ))}
      </div>
  )

  if (cadastro) return <CadastroShell area="resources" title={asset.name} step={cadastroStep} go={go} dirty={stepDirty} busy={wizard.busy || stepSaving} canPublish={firstMissing == null && wizard.access.menuWrite} onPublish={() => void wizard.publishMenu()} onBack={() => navigate("/configuracoes/recursos")}>
    {cadastroStep === "categorias" ? <CadastroTaxonomyStep onDirtyChange={setStepDirty} onSavingChange={setStepSaving} /> : body}
  </CadastroShell>

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-4 pb-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("rentals.resources.eyebrow")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
          <ItemStatusBadge status={serverStatus ?? status} />
        </div>
        {firstMissing ? (
          <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => setOpen(firstMissing)}>{t("assistant.continue", { step: t(`assistant.steps.${firstMissing}`) })}</Button>
        ) : (
          <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={wizard.busy} onClick={() => wizard.publishMenu()}>{t("assistant.publish")}</Button>
        )}
      </header>
      {body}
    </div>
  )
}

function numberDraftDiffers(text: string, stored: number | null | undefined): boolean {
  const trimmed = text.trim()
  if (trimmed === "") return typeof stored === "number"
  if (!/^\d+$/.test(trimmed)) return true
  return Number(trimmed) !== stored
}

function InheritedNumberControl({
  title,
  note,
  stored,
  effective,
  inheritedText,
  inheritedNone,
  overrideText,
  inputLabel,
  invalidText,
  max,
  busy,
  onSave,
  onDirtyChange,
}: {
  title: string
  note?: string
  stored: number | null | undefined
  effective: number | null | undefined
  inheritedText: (count: number) => string
  inheritedNone: string
  overrideText: (count: number) => string
  inputLabel: string
  invalidText: string
  max: number
  busy: boolean
  onSave: (value: number | null) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const [invalid, setInvalid] = useState(false)
  const hasOverride = typeof stored === "number"
  const storedText = hasOverride ? String(stored) : ""
  const [value, setValue] = useState(storedText)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the stored number replaces the draft after save or inherit
    setValue(storedText)
  }, [storedText])
  useEffect(() => {
    onDirtyChange?.(numberDraftDiffers(value, stored))
    return () => onDirtyChange?.(false)
  }, [value, stored, onDirtyChange])
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      <p className="text-sm" role="status">
        {hasOverride ? overrideText(stored) : typeof effective === "number" ? inheritedText(effective) : inheritedNone}
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          const raw = String(new FormData(event.currentTarget).get("value") ?? "").trim()
          if (!/^\d+$/.test(raw)) {
            setInvalid(true)
            return
          }
          const value = Number(raw)
          if (!Number.isInteger(value) || value > max) {
            setInvalid(true)
            return
          }
          setInvalid(false)
          onSave(value)
        }}
      >
        <label className="block min-w-0 flex-1 space-y-1 text-sm font-medium">
          {inputLabel}
          <Input name="value" inputMode="numeric" className="min-h-11" value={value} aria-invalid={invalid} onChange={(event) => setValue(event.target.value)} />
        </label>
        <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={busy}>{t("assistant.saveStep")}</Button>
      </form>
      {invalid ? <p role="alert" className="text-sm text-destructive">{invalidText}</p> : null}
      {hasOverride ? (
        <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={() => onSave(null)}>{t("assistant.useInherited")}</Button>
      ) : null}
    </section>
  )
}

function QueueStep({ asset, busy, canWrite, onSave }: {
  asset: AdminRentalAsset
  busy: boolean
  canWrite: boolean
  onSave: (enabled: boolean, openingTime: string) => Promise<void>
}) {
  const { t } = useTranslation()
  if (asset.type !== "Location") {
    return <p className="text-sm text-muted-foreground" role="status">{t("rentals.resourceWizard.details.queue.notApplicable")}</p>
  }
  return (
    <div role="group" aria-label={t("assistant.steps.fila")} className="flex flex-wrap gap-2">
      <Button type="button" className="min-h-11" variant={asset.queueEnabled ? "outline" : "default"} aria-pressed={!asset.queueEnabled} disabled={!canWrite || busy} onClick={() => void onSave(false, "")}>{t("assistant.queueOff")}</Button>
      <Button type="button" className="min-h-11" variant={asset.queueEnabled ? "default" : "outline"} aria-pressed={asset.queueEnabled} disabled={!canWrite || busy} onClick={() => void onSave(true, asset.queueOpeningTime?.slice(0, 5) || "08:00")}>{t("assistant.queueOn")}</Button>
    </div>
  )
}

function RulesStep({ asset, busy, products, onDurations, onCutoff, onLead, onDeposit, onDirtyChange }: {
  asset: AdminRentalAsset
  busy: boolean
  products: readonly CatalogProduct[]
  onDurations: (minutes: number[]) => void
  onCutoff: (hours: number | null) => void
  onLead: (minutes: number | null) => void
  onDeposit: (percent: number | null) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const [leadDirty, setLeadDirty] = useState(false)
  const [depositDirty, setDepositDirty] = useState(false)
  useEffect(() => { onDirtyChange?.(leadDirty || depositDirty) }, [leadDirty, depositDirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])
  const selected = parseDurations(asset.allowedDurationMinutes)
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{t("assistant.durations")}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {DURATIONS.map((minutes) => {
            const on = selected.includes(minutes)
            return (
              <Button key={minutes} type="button" className="min-h-11" variant={on ? "default" : "outline"} aria-pressed={on} disabled={busy} onClick={() => onDurations(on ? selected.filter((item) => item !== minutes) : [...selected, minutes].sort((a, b) => a - b))}>
                {t("assistant.minutes", { count: minutes })}
              </Button>
            )
          })}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold">{t("assistant.cancelCutoff")}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" className="min-h-11" variant={asset.cancelCutoffHours == null ? "default" : "outline"} aria-pressed={asset.cancelCutoffHours == null} disabled={busy} onClick={() => onCutoff(null)}>{t("assistant.cutoffInherit")}</Button>
          <Button type="button" className="min-h-11" variant={asset.cancelCutoffHours === 0 ? "default" : "outline"} aria-pressed={asset.cancelCutoffHours === 0} disabled={busy} onClick={() => onCutoff(0)}>{t("assistant.cutoffNone")}</Button>
          {CUTOFFS.map((hours) => (
            <Button key={hours} type="button" className="min-h-11" variant={asset.cancelCutoffHours === hours ? "default" : "outline"} aria-pressed={asset.cancelCutoffHours === hours} disabled={busy} onClick={() => onCutoff(hours)}>{t("assistant.hours", { count: hours })}</Button>
          ))}
        </div>
      </div>
      <InheritedNumberControl
        title={t("assistant.leadTitle")}
        stored={asset.minimumBookingLeadMinutes}
        effective={asset.effectiveMinimumBookingLeadMinutes}
        inheritedText={(count) => t("assistant.leadInherited", { count })}
        inheritedNone={t("assistant.leadInheritedNone")}
        overrideText={(count) => t("assistant.leadOverride", { count })}
        inputLabel={t("assistant.leadInput")}
        invalidText={t("assistant.leadInvalid")}
        max={525600}
        busy={busy}
        onSave={onLead}
        onDirtyChange={onDirtyChange ? setLeadDirty : undefined}
      />
      <InheritedNumberControl
        title={t("assistant.depositTitle")}
        note={t("assistant.depositStoredOnly")}
        stored={asset.depositPercent}
        effective={asset.effectiveDepositPercent}
        inheritedText={(count) => t("assistant.depositInherited", { count })}
        inheritedNone={t("assistant.depositInheritedNone")}
        overrideText={(count) => t("assistant.depositOverride", { count })}
        inputLabel={t("assistant.depositInput")}
        invalidText={t("assistant.depositInvalid")}
        max={100}
        busy={busy}
        onSave={onDeposit}
        onDirtyChange={onDirtyChange ? setDepositDirty : undefined}
      />
      <section aria-label={t("assistant.audienceTitle")} className="space-y-2">
        <h3 className="text-sm font-semibold">{t("assistant.audienceTitle")}</h3>
        {products.length === 0 ? <p className="text-sm text-muted-foreground">{t("assistant.audienceEmpty")}</p> : products.map((product) => (
          <p key={product.id} className="text-sm">
            {product.name}: {product.visibility === "Restricted" ? t("assistant.audienceRestricted") : t("assistant.audiencePublic")}{" "}
            <Link className="font-medium text-primary underline-offset-4 hover:underline" to={productWizardPath(product.id, "access")}>{t("assistant.editAudience")}</Link>
          </p>
        ))}
      </section>
    </div>
  )
}
