import { useTranslation } from "react-i18next"
import { pricingUnitSchema } from "@/api/generated/rentalPricing"

import { FieldLabel } from "@/components/ui/field-label"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { PriceInput } from "@/features/assets/components/PriceInput"
import {
  DAYS,
  type PricingEditorState,
  type PricingPattern,
} from "@/features/assets/components/assetWizardPricing"

type AssetWizardPricingStepProps = {
  pricing: PricingEditorState
  invalid: boolean
  onChange: (patch: Partial<PricingEditorState>) => void
}

const PATTERNS: readonly PricingPattern[] = [
  "sameEveryDay",
  "weekendSpecial",
  "perDay",
]

export function AssetWizardPricingStep({
  pricing,
  invalid,
  onChange,
}: AssetWizardPricingStepProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="pricing-unit">{t("assets.wizard.pricing.unitLabel")}</Label>
        <Select value={pricing.perDayUnits ? "" : pricing.pricingUnit} onValueChange={(value) => {
          const parsed = pricingUnitSchema.safeParse(value)
          if (parsed.success) onChange({ pricingUnit: parsed.data, perDayUnits: null })
        }}>
          <SelectTrigger id="pricing-unit"><SelectValue>{pricing.perDayUnits ? t("assets.wizard.pricing.units.mixed") : t(`assets.wizard.pricing.units.${pricing.pricingUnit}`)}</SelectValue></SelectTrigger>
          <SelectContent>
            {pricingUnitSchema.options.map((unit) => <SelectItem key={unit} value={unit}>{t(`assets.wizard.pricing.units.${unit}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {t("assets.wizard.pricing.patternLabel")}
        </p>
        <div className="grid gap-2">
          {PATTERNS.map((pattern) => {
            const selected = pricing.pattern === pattern
            return (
              <button
                key={pattern}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-muted/40",
                )}
                onClick={() => {
                  onChange({ pattern })
                }}
              >
                <span className="block text-sm font-medium">
                  {t(`assets.wizard.pricing.patterns.${pattern}.title`)}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t(`assets.wizard.pricing.patterns.${pattern}.hint`)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("assets.detail.rental.startTime")}</Label>
          <Input
            type="time"
            value={pricing.startTime}
            aria-invalid={invalid || undefined}
            onChange={(event) => {
              onChange({ startTime: event.target.value })
            }}
          />
        </div>
        <div className="space-y-1">
          <Label>{t("assets.detail.rental.endTime")}</Label>
          <Input
            type="time"
            value={pricing.endTime}
            aria-invalid={invalid || undefined}
            onChange={(event) => {
              onChange({ endTime: event.target.value })
            }}
          />
        </div>
      </div>

      {pricing.pattern === "sameEveryDay" ? (
        <div className="space-y-1">
          <FieldLabel
            htmlFor="pricing-everyday"
            label={t(`assets.wizard.pricing.priceLabels.${pricing.pricingUnit}`)}
            help={t("assets.wizard.pricing.everydayPriceHelp")}
            required
          />
          <PriceInput
            id="pricing-everyday"
            value={pricing.everydayPrice}
            invalid={invalid}
            onChange={(next) => {
              onChange({
                everydayPrice: next,
                weekdayPrice: next,
                weekendPrice: next,
              })
            }}
          />
        </div>
      ) : null}

      {pricing.pattern === "weekendSpecial" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <FieldLabel
              htmlFor="pricing-weekday"
              label={`${t("assets.wizard.pricing.weekdayPrice")} · ${t(`assets.wizard.pricing.priceLabels.${pricing.pricingUnit}`)}`}
              help={t("assets.wizard.pricing.weekdayPriceHelp")}
              required
            />
            <PriceInput
              id="pricing-weekday"
              value={pricing.weekdayPrice}
              invalid={invalid}
              onChange={(next) => {
                onChange({ weekdayPrice: next })
              }}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel
              htmlFor="pricing-weekend"
              label={`${t("assets.wizard.pricing.weekendPrice")} · ${t(`assets.wizard.pricing.priceLabels.${pricing.pricingUnit}`)}`}
              help={t("assets.wizard.pricing.weekendPriceHelp")}
              required
            />
            <PriceInput
              id="pricing-weekend"
              value={pricing.weekendPrice}
              invalid={invalid}
              onChange={(next) => {
                onChange({ weekendPrice: next })
              }}
            />
          </div>
        </div>
      ) : null}

      {pricing.pattern === "perDay" ? (
        <div className="space-y-2">
          <FieldLabel
            label={t(`assets.wizard.pricing.priceLabels.${pricing.pricingUnit}`)}
            help={t("assets.wizard.pricing.perDayPricesHelp")}
          />
          <ul className="space-y-2">
            {DAYS.map((day) => (
              <li
                key={day}
                className="grid grid-cols-[1fr_8rem] items-start gap-3"
              >
                <Label htmlFor={`pricing-day-${day}`}>
                  {t(`assets.detail.days.${day}`)}
                </Label>
                <PriceInput
                  id={`pricing-day-${day}`}
                  value={pricing.perDayPrices[day]}
                  invalid={invalid}
                  allowEmpty
                  onChange={(next) => {
                    onChange({
                      perDayPrices: {
                        ...pricing.perDayPrices,
                        [day]: next,
                      },
                    })
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
