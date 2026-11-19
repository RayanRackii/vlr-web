import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { AssetFamilyField } from "@/features/assets/schemas/assetFamilySchemas"

type FieldControlProps = {
  id: string
  "aria-required"?: boolean | undefined
  "aria-invalid"?: boolean | undefined
  "aria-describedby"?: string | undefined
  onBlur: () => void
}

type AssetFamilyFieldsProps = {
  fields: readonly AssetFamilyField[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  disabled?: boolean
  /** Id, aria and blur wiring for one control; callers own the id scheme. */
  controlProps: (key: string, required: boolean) => FieldControlProps
  /** Message shown under the field, or null/undefined when the field is valid. */
  errorFor: (key: string) => string | null | undefined
  className?: string
}

/** Renders a family's `fieldSchema` fields. Shared by the asset wizard and the Recursos form. */
export function AssetFamilyFields({
  fields,
  values,
  onChange,
  disabled = false,
  controlProps,
  errorFor,
  className = "grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2",
}: AssetFamilyFieldsProps) {
  const { t } = useTranslation()
  if (fields.length === 0) return null

  return (
    <div className={className}>
      {fields.map((familyField) => {
        const props = controlProps(familyField.key, familyField.required)
        const error = errorFor(familyField.key)
        return (
          <div key={familyField.key} className="space-y-2">
            <Label htmlFor={props.id} className="text-sm font-medium">
              {t(`assets.wizard.familyFields.${familyField.key}`, {
                defaultValue: familyField.label ?? familyField.key,
              })}
              {familyField.required
                ? <span className="ml-1 text-destructive" aria-hidden="true">*</span>
                : ` (${t("common.optional")})`}
            </Label>
            {familyField.type === "boolean" ? (
              <Switch
                disabled={disabled}
                {...props}
                checked={values[familyField.key] === "true"}
                onCheckedChange={(checked) => {
                  onChange({ ...values, [familyField.key]: checked ? "true" : "false" })
                }}
              />
            ) : (
              <Input
                {...props}
                disabled={disabled}
                className={error ? "border-destructive focus-visible:border-destructive" : ""}
                type={familyField.type === "number" ? "number" : "text"}
                value={values[familyField.key] ?? ""}
                onChange={(event) => {
                  onChange({ ...values, [familyField.key]: event.target.value })
                }}
              />
            )}
            {familyField.key === "voltage" || familyField.key === "volts" ? (
              <p id={`${props.id}-help`} className="text-xs text-muted-foreground">
                {t("assets.wizard.help.voltage")}
              </p>
            ) : null}
            {error ? (
              <p id={`${props.id}-error`} className="text-xs text-destructive">{error}</p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
