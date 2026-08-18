import { useTranslation } from "react-i18next"

import { FieldLabel } from "@/components/ui/field-label"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
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
            label={t("assets.wizard.pricing.everydayPrice")}
            help={t("assets.wizard.pricing.everydayPriceHelp")}
            required
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            value={pricing.everydayPrice}
            aria-invalid={invalid || undefined}
            onChange={(event) => {
              const next = event.target.valueAsNumber
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
              label={t("assets.wizard.pricing.weekdayPrice")}
              help={t("assets.wizard.pricing.weekdayPriceHelp")}
              required
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              value={pricing.weekdayPrice}
              aria-invalid={invalid || undefined}
              onChange={(event) => {
                onChange({ weekdayPrice: event.target.valueAsNumber })
              }}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel
              label={t("assets.wizard.pricing.weekendPrice")}
              help={t("assets.wizard.pricing.weekendPriceHelp")}
              required
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              value={pricing.weekendPrice}
              aria-invalid={invalid || undefined}
              onChange={(event) => {
                onChange({ weekendPrice: event.target.valueAsNumber })
              }}
            />
          </div>
        </div>
      ) : null}

      {pricing.pattern === "perDay" ? (
        <div className="space-y-2">
          <FieldLabel
            label={t("assets.wizard.pricing.perDayPrices")}
            help={t("assets.wizard.pricing.perDayPricesHelp")}
          />
          <ul className="space-y-2">
            {DAYS.map((day) => (
              <li
                key={day}
                className="grid grid-cols-[1fr_8rem] items-center gap-3"
              >
                <Label htmlFor={`pricing-day-${day}`}>
                  {t(`assets.detail.days.${day}`)}
                </Label>
                <Input
                  id={`pricing-day-${day}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={pricing.perDayPrices[day]}
                  aria-invalid={invalid || undefined}
                  onChange={(event) => {
                    onChange({
                      perDayPrices: {
                        ...pricing.perDayPrices,
                        [day]: event.target.valueAsNumber,
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
