import { useId } from "react"

import { AssetAttributeField, type FieldControlProps } from "@/features/assets/components/AssetAttributeField"
import type { AttributeFormValue } from "@/features/assets/lib/assetAttributeValues"
import type { AssetFamilyField } from "@/features/assets/schemas/assetFamilySchemas"

type AssetAttributeFieldsProps = {
  fields: readonly AssetFamilyField[]
  values: Record<string, AttributeFormValue | undefined>
  onChange: (key: string, value: AttributeFormValue) => void
  disabled?: boolean
  /** Id, aria and blur wiring for one control; callers own the id scheme. */
  controlProps: (key: string, required: boolean) => FieldControlProps
  /** Message shown under the field, or null/undefined when the field is valid. */
  errorFor: (key: string) => string | null | undefined
  className?: string
}

type FieldBlock = { group: string | null; fields: AssetFamilyField[] }

/** Archived fields never render; consecutive fields with the same non-empty group form one block. */
function toBlocks(fields: readonly AssetFamilyField[]): FieldBlock[] {
  const blocks: FieldBlock[] = []
  for (const field of fields) {
    if (field.archived) continue
    const group = field.group?.trim() || null
    const last = blocks[blocks.length - 1]
    if (group && last?.group === group) {
      last.fields.push(field)
    } else {
      blocks.push({ group, fields: [field] })
    }
  }
  return blocks
}

/** Renders a family's `fieldSchema` fields. Shared by the asset wizard and the Recursos form. */
export function AssetAttributeFields({
  fields,
  values,
  onChange,
  disabled = false,
  controlProps,
  errorFor,
  className = "grid min-w-0 gap-3 rounded-lg border border-border p-3 sm:grid-cols-2",
}: AssetAttributeFieldsProps) {
  const headingPrefix = useId()
  const blocks = toBlocks(fields)
  if (blocks.length === 0) return null

  const renderField = (field: AssetFamilyField) => (
    <AssetAttributeField
      key={field.key}
      field={field}
      value={values[field.key]}
      disabled={disabled}
      onChange={(next) => onChange(field.key, next)}
      controlProps={controlProps(field.key, field.required)}
      errorMessage={errorFor(field.key)}
    />
  )

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        const [first] = block.fields
        if (!block.group || !first) return block.fields.map(renderField)
        const headingId = `${headingPrefix}-group-${index}`
        return (
          <div
            key={`group:${block.group}:${first.key}`}
            role="group"
            aria-labelledby={headingId}
            className="min-w-0 space-y-3 rounded-lg border border-border/60 p-3 sm:col-span-2"
          >
            <p id={headingId} className="text-sm font-semibold">{block.group}</p>
            <div className={block.fields.length === 3 ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
              {block.fields.map(renderField)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
