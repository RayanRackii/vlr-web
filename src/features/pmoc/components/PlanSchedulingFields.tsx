import { useState, type Ref } from "react"
import { CivilDateInput } from "@/components/CivilDateInput"
import type { Control, FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LiveFieldMessage } from "@/features/pmoc/components/FormValidationSummary"

/** Frequency presets; every one maps to the same `intervalDays` the API stores. */
const FREQUENCY_PRESETS = [
  { key: "monthly", days: 30 },
  { key: "quarterly", days: 90 },
  { key: "semiannual", days: 180 },
  { key: "annual", days: 365 },
] as const

function isPresetDays(value: unknown) {
  return FREQUENCY_PRESETS.some((preset) => preset.days === value)
}

function FrequencyControl({
  value,
  onChange,
  onBlur,
  name,
  inputRef,
}: {
  value: unknown
  onChange: (value: number) => void
  onBlur: () => void
  name: string
  inputRef: Ref<HTMLInputElement>
}) {
  const { t } = useTranslation()
  const days = typeof value === "number" && Number.isFinite(value) ? value : null
  const [custom, setCustom] = useState(() => days !== null && !isPresetDays(days))
  const customSelected = custom || (days !== null && !isPresetDays(days))

  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label={t("pmoc.newPlan.form.frequency")}
        className="flex flex-wrap gap-2"
      >
        {FREQUENCY_PRESETS.map((preset) => {
          const selected = !customSelected && days === preset.days
          return (
            <Button
              key={preset.key}
              type="button"
              size="sm"
              className="min-h-11"
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              onClick={() => {
                setCustom(false)
                onChange(preset.days)
                onBlur()
              }}
            >
              {t(`pmoc.newPlan.form.presets.${preset.key}`)}
            </Button>
          )
        })}
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          variant={customSelected ? "default" : "outline"}
          aria-pressed={customSelected}
          onClick={() => {
            setCustom(true)
          }}
        >
          {t("pmoc.newPlan.form.presets.custom")}
        </Button>
      </div>
      {customSelected ? (
        <div className="flex items-center gap-2">
          <FormControl>
            <Input
              type="number"
              inputMode="numeric"
              step={1}
              autoComplete="off"
              className="w-28"
              aria-label={t("pmoc.newPlan.form.customDays")}
              name={name}
              ref={inputRef}
              onBlur={onBlur}
              value={days ?? ""}
              onChange={(event) => {
                const raw = event.target.value
                onChange(raw === "" ? Number.NaN : event.target.valueAsNumber)
              }}
            />
          </FormControl>
          <span className="text-sm text-muted-foreground">{t("pmoc.scheduling.days")}</span>
        </div>
      ) : null}
    </div>
  )
}

export function PlanSchedulingFields<T extends FieldValues>({
  control,
  intervalMessage,
  firstDueMessage,
}: {
  control: Control<T>
  intervalMessage?: string
  firstDueMessage?: string
}) {
  const { t, i18n } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name={"intervalDays" as Path<T>}
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>{t("pmoc.newPlan.form.frequency")}</FormLabel>
              <FrequencyControl
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
              />
              {intervalMessage ? (
                <LiveFieldMessage message={intervalMessage} />
              ) : (
                <FormMessage />
              )}
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={"firstDueDate" as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("pmoc.scheduling.firstDue")}</FormLabel>
              <FormControl>
                <CivilDateInput locale={i18n.resolvedLanguage ?? i18n.language} autoComplete="off" {...field} value={String(field.value ?? "")} />
              </FormControl>
              {firstDueMessage ? (
                <LiveFieldMessage message={firstDueMessage} />
              ) : (
                <FormMessage />
              )}
            </FormItem>
          )}
        />
      </div>
      <p className="text-sm text-muted-foreground">{t("pmoc.newPlan.scheduleHelper")}</p>
    </div>
  )
}
