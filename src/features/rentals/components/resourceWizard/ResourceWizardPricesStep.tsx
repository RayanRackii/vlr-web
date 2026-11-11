import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { toHtmlTimeInput } from "@/features/assets/schemas/assetSchemas"
import type { RentalPricing } from "@/features/assets/services/rentalPricingService"
import { Time24Input } from "@/components/Time24Input"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  parseWizardPrice,
  queueDraftIsValid,
  wizardPriceDraftIsValid,
  wizardPricingUnits,
  type WizardPricingUnit,
} from "@/features/rentals/components/resourceWizard/wizardDrafts"
import { formatScheduleTime, type AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { formatLocaleCurrency } from "@/lib/localeFormat"

type PriceDraft = {
  amount: string
  pricingUnit: WizardPricingUnit
  startTime: string
  endTime: string
}

type ResourceWizardPricesStepProps = {
  asset: AdminRentalAsset
  prices: readonly RentalPricing[] | null
  canReadPricing: boolean
  canWritePricing: boolean
  canReplacePricing: boolean
  canWriteAsset: boolean
  busy: boolean
  onSavePrices: (draft: PriceDraft) => Promise<void>
  onSaveQueue: (enabled: boolean, openingTime: string) => Promise<void>
  showQueue?: boolean
  onDirtyChange?: (dirty: boolean) => void
}

export function ResourceWizardPricesStep({
  asset,
  prices,
  canReadPricing,
  canWritePricing,
  canReplacePricing,
  canWriteAsset,
  busy,
  onSavePrices,
  onSaveQueue,
  showQueue = true,
  onDirtyChange,
}: ResourceWizardPricesStepProps) {
  const { t, i18n } = useTranslation()

  return (
    <section className="space-y-6" aria-labelledby="wizard-prices-title">
      <div>
        <h2 id="wizard-prices-title" className="text-lg font-semibold">
          {t("rentals.resourceWizard.prices.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("rentals.resourceWizard.prices.description")}
        </p>
      </div>
      {canReadPricing ? (
        <PriceEditor
          prices={prices ?? []}
          canWrite={canWritePricing}
          replaces={canReplacePricing}
          busy={busy}
          locale={i18n.language}
          onSave={onSavePrices}
          onDirtyChange={onDirtyChange}
        />
      ) : (
        <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm" role="status">
          {t("rentals.resourceWizard.permission")}
        </p>
      )}
      {showQueue ? (
        <QueueEditor
          asset={asset}
          canWrite={canWriteAsset}
          busy={busy}
          onSave={onSaveQueue}
        />
      ) : null}
    </section>
  )
}

function PriceEditor({
  prices,
  canWrite,
  replaces,
  busy,
  locale,
  onSave,
  onDirtyChange,
}: {
  prices: readonly RentalPricing[]
  canWrite: boolean
  replaces: boolean
  busy: boolean
  locale: string
  onSave: (draft: PriceDraft) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const form = useForm<PriceDraft>({
    defaultValues: { amount: "", pricingUnit: "Hour", startTime: "08:00", endTime: "22:00" },
  })
  const watched = useWatch({ control: form.control })
  const isValid = wizardPriceDraftIsValid({
    amount: watched.amount ?? "",
    startTime: watched.startTime ?? "",
    endTime: watched.endTime ?? "",
  })
  const dirty = form.formState.isDirty
  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])

  return (
    <div className="space-y-4">
      {prices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("rentals.resourceWizard.prices.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {prices.map((price) => (
            <li key={price.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <span>
                {t(`rentals.schedule.days.${price.dayOfWeek}`, { defaultValue: price.dayOfWeek })}
                {" · "}
                {formatScheduleTime(price.startTime)}–{formatScheduleTime(price.endTime)}
              </span>
              <span className="font-medium tabular-nums">
                {formatLocaleCurrency(price.pricePerHour, "BRL", locale)}
                {" · "}
                {t(`assets.wizard.pricing.units.${price.pricingUnit}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <form
          className="space-y-3"
          onSubmit={(event) => form.handleSubmit(async (values) => {
            await onSave(values)
            form.reset(values)
          })(event)}
        >
          <p className="text-sm text-muted-foreground">
            {t(replaces ? "rentals.resourceWizard.prices.replaceHint" : "rentals.resourceWizard.prices.addHint")}
          </p>
          <label className="block space-y-1 text-sm font-medium">
            {t("rentals.resourceWizard.prices.amount")}
            <Input className="min-h-11" inputMode="decimal" disabled={busy} {...form.register("amount")} />
          </label>
          <div role="radiogroup" aria-label={t("assets.wizard.pricing.unitLabel")} className="flex flex-wrap gap-2">
            {wizardPricingUnits.map((unit) => {
              const selected = (watched.pricingUnit ?? "Hour") === unit
              return (
                <button
                  key={unit}
                  type="button"
                  aria-pressed={selected}
                  disabled={busy}
                  className={`min-h-11 rounded-full border px-3 text-sm font-medium ${selected ? "border-primary bg-primary/10" : "border-border"}`}
                  onClick={() => form.setValue("pricingUnit", unit, { shouldDirty: true })}
                >
                  {t(`assets.wizard.pricing.units.${unit}`)}
                </button>
              )
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium">
              {t("rentals.resourceWizard.prices.start")}
              <Time24Input
                className="min-h-11"
                disabled={busy}
                value={watched.startTime ?? ""}
                onValueChange={(next) => form.setValue("startTime", next, { shouldDirty: true })}
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              {t("rentals.resourceWizard.prices.end")}
              <Time24Input
                className="min-h-11"
                disabled={busy}
                value={watched.endTime ?? ""}
                onValueChange={(next) => form.setValue("endTime", next, { shouldDirty: true })}
              />
            </label>
          </div>
          {!isValid && (watched.amount ?? "").trim().length > 0 ? (
            <p className="text-sm text-destructive" role="alert">
              {parseWizardPrice(watched.amount ?? "") === null
                ? t("rentals.resourceWizard.prices.invalidPrice")
                : t("rentals.resourceWizard.prices.invalidTime")}
            </p>
          ) : null}
          <FormPrimaryButton type="submit" className="min-h-11 w-full sm:w-auto" isValid={isValid} loading={busy} disabled={busy}>
            {t(replaces ? "rentals.resourceWizard.prices.applyReplace" : "rentals.resourceWizard.prices.applyAdd")}
          </FormPrimaryButton>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">{t("rentals.resourceWizard.prices.readOnly")}</p>
      )}
    </div>
  )
}

function QueueEditor({
  asset,
  canWrite,
  busy,
  onSave,
}: {
  asset: AdminRentalAsset
  canWrite: boolean
  busy: boolean
  onSave: (enabled: boolean, openingTime: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const form = useForm({
    defaultValues: {
      queueEnabled: asset.type === "Location" && asset.queueEnabled,
      queueOpeningTime: toHtmlTimeInput(asset.queueOpeningTime),
    },
  })
  const watched = useWatch({ control: form.control })
  const enabled = watched.queueEnabled === true
  const openingTime = watched.queueOpeningTime ?? ""
  const isValid = queueDraftIsValid(asset.type === "Good" ? "Good" : "Location", enabled, openingTime)

  if (asset.type !== "Location") {
    return (
      <p className="rounded-xl border border-border p-4 text-sm" role="status">
        {t("rentals.resourceWizard.details.queue.notApplicable")}
      </p>
    )
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-border p-4"
      onSubmit={(event) => {
        void form.handleSubmit(async (values) => {
          await onSave(values.queueEnabled, values.queueOpeningTime)
        })(event)
      }}
    >
      <div>
        <h3 className="text-sm font-semibold">{t("rentals.resourceWizard.prices.queueTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("rentals.resourceWizard.prices.queueHelp")}</p>
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
        {t("rentals.resourceWizard.prices.queueToggle")}
        <Switch
          checked={enabled}
          disabled={!canWrite || busy}
          onCheckedChange={(checked) => form.setValue("queueEnabled", checked, { shouldDirty: true })}
        />
      </label>
      {enabled ? (
        <label className="block space-y-1 text-sm font-medium">
          {t("rentals.resources.form.queueOpeningTime")}
          <Time24Input
            className="min-h-11"
            disabled={!canWrite || busy}
            value={openingTime}
            onValueChange={(next) => form.setValue("queueOpeningTime", next, { shouldDirty: true })}
          />
        </label>
      ) : null}
      {canWrite ? (
        <FormPrimaryButton type="submit" className="min-h-11 w-full sm:w-auto" isValid={isValid} loading={busy} disabled={busy}>
          {t("common.save")}
        </FormPrimaryButton>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">{t("rentals.resourceWizard.prices.queueReadOnly")}</p>
      )}
    </form>
  )
}
