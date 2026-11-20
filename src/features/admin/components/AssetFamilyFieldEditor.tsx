import { useId, useState } from "react"
import { Archive, ArchiveRestore, Plus, Shapes, Trash2, X } from "lucide-react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AssetAttributeField } from "@/features/assets/components/AssetAttributeField"
import type { AttributeFormValue } from "@/features/assets/lib/assetAttributeValues"
import {
  ASSET_FAMILY_FIELD_TYPES,
  type AssetFamilyField,
} from "@/features/assets/schemas/assetFamilySchemas"
import {
  isKnownAssetFamilyFieldType,
  type AdminAssetFamilyFormValues,
  type AssetFamilyFieldType,
} from "@/features/admin/schemas/adminAssetFamilySchemas"

type AssetFamilyFieldEditorProps = {
  form: UseFormReturn<AdminAssetFamilyFormValues>
  index: number
  /** 1-based position among the active fields, shown in the card title. */
  number: number
  onRemove: () => void
}

function isFieldType(value: unknown): value is AssetFamilyFieldType {
  return (ASSET_FAMILY_FIELD_TYPES as readonly unknown[]).includes(value)
}

function numberOrNull(text: string): number | null {
  const parsed = Number(text.trim().replace(",", "."))
  return text.trim() !== "" && Number.isFinite(parsed) ? parsed : null
}

function integerOrNull(text: string): number | null {
  const parsed = numberOrNull(text)
  return parsed !== null && Number.isInteger(parsed) ? parsed : null
}

function OptionsEditor({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {t("admin.assetFamilies.form.options")}
      </Label>
      {value.map((option, optionIndex) => (
        <div key={optionIndex} className="flex items-center gap-2">
          <Input
            autoComplete="off"
            value={option}
            aria-label={t("admin.assetFamilies.form.optionItem", {
              number: optionIndex + 1,
            })}
            onChange={(event) => {
              onChange(
                value.map((item, itemIndex) =>
                  itemIndex === optionIndex ? event.target.value : item,
                ),
              )
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("admin.assetFamilies.form.removeOption", {
              number: optionIndex + 1,
            })}
            onClick={() => {
              onChange(value.filter((_, itemIndex) => itemIndex !== optionIndex))
            }}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          onChange([...value, ""])
        }}
      >
        <Plus data-icon="inline-start" />
        {t("admin.assetFamilies.form.addOption")}
      </Button>
    </div>
  )
}

function FieldPreview({ field }: { field: AssetFamilyField }) {
  const { t } = useTranslation()
  const id = useId()
  const [value, setValue] = useState<AttributeFormValue>("")

  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {t("admin.assetFamilies.form.preview")}
      </p>
      <AssetAttributeField
        field={field}
        value={value}
        onChange={setValue}
        controlProps={{ id: `${id}-preview`, onBlur: () => undefined }}
      />
    </div>
  )
}

export function AssetFamilyFieldEditor({
  form,
  index,
  number,
  onRemove,
}: AssetFamilyFieldEditorProps) {
  const { t } = useTranslation()
  const row = useWatch({ control: form.control, name: `fields.${index}` })
  const fieldTypeItems = ASSET_FAMILY_FIELD_TYPES.map((type) => ({
    value: type,
    label: t(`admin.assetFamilies.types.${type}`),
  }))

  const setArchived = (archived: boolean) => {
    form.setValue(`fields.${index}.archived`, archived, {
      shouldDirty: true,
      shouldValidate: true,
    })
    if (archived) {
      form.setValue(`fields.${index}.required`, false, { shouldDirty: true })
    }
  }

  if (row.archived) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium [overflow-wrap:anywhere]">
            {row.label.trim() !== "" ? row.label : row.key}
          </span>
          <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {row.key}
          </span>
          <Badge variant="secondary">
            {t("admin.assetFamilies.form.archivedBadge")}
          </Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setArchived(false)
          }}
        >
          <ArchiveRestore data-icon="inline-start" />
          {t("admin.assetFamilies.form.restore")}
          <span className="sr-only"> {row.key}</span>
        </Button>
      </div>
    )
  }

  if (!isKnownAssetFamilyFieldType(row.type)) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium [overflow-wrap:anywhere]">
            {row.label.trim() !== "" ? row.label : row.key}{" "}
            <span className="text-xs font-normal text-muted-foreground">{row.key}</span>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setArchived(true)
            }}
          >
            <Archive data-icon="inline-start" />
            {t("admin.assetFamilies.form.archive")}
            <span className="sr-only"> {row.key}</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" role="status">
          {t("admin.assetFamilies.form.unknownType", { type: row.type })}
        </p>
      </div>
    )
  }

  const type = row.type
  const previewField: AssetFamilyField = {
    key: row.key.trim() !== "" ? row.key.trim() : "preview",
    type,
    required: row.required,
    label: row.label.trim() !== "" ? row.label.trim() : null,
    help: row.help.trim() !== "" ? row.help.trim() : null,
    group: null,
    unit: type === "number" && row.unit.trim() !== "" ? row.unit.trim() : null,
    min: type === "number" ? numberOrNull(row.min) : null,
    max: type === "number" ? numberOrNull(row.max) : null,
    decimals: type === "number" ? integerOrNull(row.decimals) : null,
    options:
      type === "select" || type === "multiselect"
        ? row.options.map((option) => option.trim()).filter((option) => option !== "")
        : null,
    maxLength:
      type === "text" || type === "longtext" ? integerOrNull(row.maxLength) : null,
    archived: false,
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {t("admin.assetFamilies.form.fieldItem", { number })}
        </p>
        {row.existing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setArchived(true)
            }}
          >
            <Archive data-icon="inline-start" />
            {t("admin.assetFamilies.form.archive")}
            <span className="sr-only"> {row.key}</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("admin.assetFamilies.form.removeField")}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name={`fields.${index}.key`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.assetFamilies.form.fieldKey")}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  spellCheck={false}
                  disabled={row.existing}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`fields.${index}.label`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.assetFamilies.form.fieldLabel")}</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`fields.${index}.type`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.assetFamilies.form.fieldType")}</FormLabel>
              <Select
                modal={false}
                value={field.value}
                items={fieldTypeItems}
                onValueChange={(value) => {
                  if (isFieldType(value)) {
                    field.onChange(value)
                  }
                }}
              >
                <FormControl>
                  <SelectTrigger icon={Shapes} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {fieldTypeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`fields.${index}.group`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.assetFamilies.form.group")}</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name={`fields.${index}.help`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("admin.assetFamilies.form.help")}</FormLabel>
            <FormControl>
              <Input autoComplete="off" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {type === "number" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["unit", "min", "max", "decimals"] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={`fields.${index}.${name}`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t(`admin.assetFamilies.form.${name}`)}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      inputMode={name === "unit" ? "text" : "decimal"}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
      ) : null}

      {type === "text" || type === "longtext" ? (
        <FormField
          control={form.control}
          name={`fields.${index}.maxLength`}
          render={({ field }) => (
            <FormItem className="sm:max-w-48">
              <FormLabel>{t("admin.assetFamilies.form.maxLength")}</FormLabel>
              <FormControl>
                <Input autoComplete="off" inputMode="numeric" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      {type === "select" || type === "multiselect" ? (
        <FormField
          control={form.control}
          name={`fields.${index}.options`}
          render={({ field }) => (
            <FormItem>
              <OptionsEditor value={field.value} onChange={field.onChange} />
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      <FormField
        control={form.control}
        name={`fields.${index}.required`}
        render={({ field }) => (
          <FormItem>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={field.value}
                onChange={(event) => {
                  field.onChange(event.target.checked)
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
              {t("admin.assetFamilies.form.fieldRequired")}
            </Label>
          </FormItem>
        )}
      />

      <FieldPreview field={previewField} />
    </div>
  )
}
