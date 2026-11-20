import { useTranslation } from "react-i18next"

import { badgeVariants } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { AttributeFormValue } from "@/features/assets/lib/assetAttributeValues"
import type { AssetFamilyField } from "@/features/assets/schemas/assetFamilySchemas"
import { cn } from "@/lib/utils"

export type FieldControlProps = {
  id: string
  "aria-required"?: boolean | undefined
  "aria-invalid"?: boolean | undefined
  "aria-describedby"?: string | undefined
  onBlur: () => void
}

type AssetAttributeFieldProps = {
  field: AssetFamilyField
  value: AttributeFormValue | undefined
  onChange: (next: AttributeFormValue) => void
  /** Id, aria and blur wiring for the control; callers own the id scheme. */
  controlProps: FieldControlProps
  errorMessage?: string | null | undefined
  disabled?: boolean
}

type Translate = (key: string, options?: Record<string, unknown>) => string

const NO_SELECTION = "__none__"
const DEFAULT_TEXT_MAX_LENGTH = 500
const DEFAULT_LONGTEXT_MAX_LENGTH = 5000

function asText(value: AttributeFormValue | undefined): string {
  return typeof value === "string" ? value : ""
}

function asList(value: AttributeFormValue | undefined): string[] {
  return Array.isArray(value) ? value : []
}

function numberHint(field: AssetFamilyField, t: Translate): string | null {
  if (field.min != null && field.max != null) {
    return t("assets.wizard.attributes.rangeBetween", { min: field.min, max: field.max })
  }
  if (field.min != null) return t("assets.wizard.attributes.rangeMin", { min: field.min })
  if (field.max != null) return t("assets.wizard.attributes.rangeMax", { max: field.max })
  return null
}

function sameToken(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

type ControlArgs = {
  field: AssetFamilyField
  value: AttributeFormValue | undefined
  onChange: (next: AttributeFormValue) => void
  controlProps: FieldControlProps
  invalidClass: string
  disabled: boolean
  t: Translate
}

function SelectControl({ field, value, onChange, controlProps, invalidClass, disabled, t }: ControlArgs) {
  const options = field.options ?? []
  const current = asText(value)
  const legacy = current !== "" && !options.some((option) => sameToken(option, current))
  const items = [
    ...(field.required ? [] : [{ value: NO_SELECTION, label: t("assets.wizard.attributes.noSelection") }]),
    ...(legacy ? [{ value: current, label: current }] : []),
    ...options.map((option) => ({ value: option, label: option })),
  ]
  const selected = options.find((option) => sameToken(option, current)) ?? current
  let selectValue: string | null = selected
  if (selected === "") selectValue = field.required ? null : NO_SELECTION

  return (
    <Select
      modal={false}
      items={items}
      disabled={disabled}
      value={selectValue}
      onValueChange={(next) => onChange(next === NO_SELECTION || next == null ? "" : String(next))}
    >
      <SelectTrigger {...controlProps} className={cn("w-full", invalidClass)}>
        <SelectValue placeholder={t("assets.wizard.attributes.selectPlaceholder")} />
      </SelectTrigger>
      <SelectContent showScrollButtons={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function MultiselectControl({ field, value, onChange, controlProps, disabled, t }: ControlArgs) {
  const options = field.options ?? []
  const selected = asList(value)
  const legacyTokens = selected.filter((token) => !options.some((option) => sameToken(option, token)))
  const isSelected = (option: string) => selected.some((token) => sameToken(token, option))

  function toggle(option: string) {
    if (isSelected(option)) {
      onChange(selected.filter((token) => !sameToken(token, option)))
      return
    }
    // Option order, like the API stores it; legacy tokens stay first.
    onChange([
      ...legacyTokens,
      ...options.filter((candidate) => sameToken(candidate, option) || isSelected(candidate)),
    ])
  }

  return (
    <div
      id={controlProps.id}
      role="group"
      aria-labelledby={`${controlProps.id}-label`}
      aria-required={controlProps["aria-required"]}
      aria-invalid={controlProps["aria-invalid"]}
      aria-describedby={controlProps["aria-describedby"]}
      className="flex min-w-0 flex-wrap gap-2"
    >
      {legacyTokens.map((token) => (
        <button
          key={`legacy:${token}`}
          type="button"
          disabled={disabled}
          aria-pressed={true}
          title={t("assets.wizard.attributes.legacyValue")}
          className={cn(badgeVariants({ variant: "secondary" }), "touch-target h-8 max-w-full cursor-pointer px-3 italic opacity-80")}
          onClick={() => onChange(selected.filter((item) => item !== token))}
          onBlur={controlProps.onBlur}
        >
          <span className="truncate">{token}</span>
        </button>
      ))}
      {options.map((option) => {
        const pressed = isSelected(option)
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={pressed}
            className={cn(
              badgeVariants({ variant: pressed ? "default" : "outline" }),
              "touch-target h-8 max-w-full cursor-pointer px-3 disabled:cursor-not-allowed disabled:opacity-50",
            )}
            onClick={() => toggle(option)}
            onBlur={controlProps.onBlur}
          >
            <span className="truncate">{option}</span>
          </button>
        )
      })}
    </div>
  )
}

function Control(args: ControlArgs) {
  const { field, value, onChange, controlProps, invalidClass, disabled, t } = args

  switch (field.type) {
    case "boolean":
      return (
        <Switch
          disabled={disabled}
          {...controlProps}
          checked={value === true || value === "true"}
          onCheckedChange={(checked) => onChange(checked)}
        />
      )
    case "longtext": {
      const maxLength = field.maxLength ?? DEFAULT_LONGTEXT_MAX_LENGTH
      const text = asText(value)
      return (
        <>
          <Textarea
            {...controlProps}
            disabled={disabled}
            className={invalidClass}
            maxLength={maxLength}
            value={text}
            onChange={(event) => onChange(event.target.value)}
          />
          <p className="text-right text-xs text-muted-foreground" aria-hidden="true">
            {t("assets.wizard.attributes.counter", { count: text.length, max: maxLength })}
          </p>
        </>
      )
    }
    case "number":
      return (
        <div className="relative">
          <Input
            {...controlProps}
            disabled={disabled}
            className={cn(invalidClass, field.unit ? "pr-14" : "")}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={asText(value)}
            onChange={(event) => onChange(event.target.value)}
          />
          {field.unit ? (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              {field.unit}
            </span>
          ) : null}
        </div>
      )
    case "select":
      return <SelectControl {...args} />
    case "multiselect":
      return <MultiselectControl {...args} />
    default:
      return (
        <Input
          {...controlProps}
          disabled={disabled}
          className={invalidClass}
          type={field.type === "url" ? "url" : field.type === "date" ? "date" : "text"}
          inputMode={field.type === "url" ? "url" : undefined}
          maxLength={field.type === "text" ? (field.maxLength ?? DEFAULT_TEXT_MAX_LENGTH) : undefined}
          value={asText(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      )
  }
}

/** One family field: label, help, control and error. The control depends on `field.type`. */
export function AssetAttributeField({
  field,
  value,
  onChange,
  controlProps,
  errorMessage,
  disabled = false,
}: AssetAttributeFieldProps) {
  const { t } = useTranslation()
  const id = controlProps.id
  const invalidClass = errorMessage ? "border-destructive focus-visible:border-destructive" : ""
  const label = t(`assets.wizard.familyFields.${field.key}`, { defaultValue: field.label ?? field.key })
  const help = field.help ?? (field.key === "voltage" || field.key === "volts" ? t("assets.wizard.help.voltage") : null)
  const rangeHint = field.type === "number" ? numberHint(field, t as Translate) : null

  return (
    <div className={cn("min-w-0 space-y-2", field.type === "longtext" && "sm:col-span-2")}>
      <Label id={`${id}-label`} htmlFor={id} className="text-sm font-medium">
        {label}
        {field.required
          ? <span className="ml-1 text-destructive" aria-hidden="true">*</span>
          : ` (${t("common.optional")})`}
      </Label>
      <Control
        field={field}
        value={value}
        onChange={onChange}
        controlProps={controlProps}
        invalidClass={invalidClass}
        disabled={disabled}
        t={t as Translate}
      />
      {rangeHint ? <p className="text-xs text-muted-foreground">{rangeHint}</p> : null}
      {help ? <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p> : null}
      {errorMessage ? <p id={`${id}-error`} className="text-xs text-destructive">{errorMessage}</p> : null}
    </div>
  )
}
