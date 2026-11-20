import { toHtmlTimeInput } from "@/features/assets/schemas/assetSchemas"
import { attributeToInputString, toFormValue, type AttributeFormValue } from "@/features/assets/lib/assetAttributeValues"
import { emptyAttributesFromFields, type AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import type {
  RegistryCategoryListItem,
  RentalResourceFormValues,
} from "@/features/rentals/schemas/rentalResourceSchemas"
import type { VisualRevision } from "@/features/rentals/schemas/resourceVisualSchemas"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import type { VisualTemplate } from "@/features/rentals/services/resourceVisualService"

export type TemplateOption = { value: string; label: string }
export type TemplateDefaultField = "capacityPeople" | "requiresDeposit" | "horizon"

type TemplateRevisionDefaults = Pick<VisualRevision, "suggestedCapacityPeople"> & Partial<Pick<VisualRevision, "defaultRequiresDeposit" | "defaultMaxAdvanceBookingDays">>

function pickSingleId(items: readonly { id: string }[]): string {
  return items.length === 1 ? (items[0]?.id ?? "") : ""
}

export function getTemplateRevisionFormDefaults(
  revision: TemplateRevisionDefaults | null | undefined,
  editedFields: ReadonlySet<TemplateDefaultField>,
): Partial<Pick<RentalResourceFormValues, "capacityPeople" | "requiresDeposit" | "horizonMode" | "horizonDays">> {
  if (!revision) {
    return {}
  }

  const defaults: Partial<Pick<RentalResourceFormValues, "capacityPeople" | "requiresDeposit" | "horizonMode" | "horizonDays">> = {}
  if (!editedFields.has("capacityPeople") && revision.suggestedCapacityPeople != null) {
    defaults.capacityPeople = String(revision.suggestedCapacityPeople)
  }
  if (!editedFields.has("requiresDeposit") && revision.defaultRequiresDeposit != null) {
    defaults.requiresDeposit = revision.defaultRequiresDeposit
  }
  if (!editedFields.has("horizon") && revision.defaultMaxAdvanceBookingDays != null) {
    defaults.horizonMode = "days"
    defaults.horizonDays = String(revision.defaultMaxAdvanceBookingDays)
  }
  return defaults
}

export function mergeTemplateOptions(
  templates: readonly VisualTemplate[],
  createdOptions: readonly TemplateOption[],
  noTemplateLabel: string,
): TemplateOption[] {
  const options = [
    { value: "__no-template__", label: noTemplateLabel },
    ...templates.flatMap((template) =>
      template.publishedRevision
        ? [{
            value: template.publishedRevision.id,
            label: template.nameI18n["pt-BR"] ?? template.slug,
          }]
        : [],
    ),
    ...createdOptions,
  ]
  return [...new Map(options.map((option) => [option.value, option])).values()]
}

function attributesFor(family: AssetFamily, editing: AdminRentalAsset | null): Record<string, AttributeFormValue> {
  const values = emptyAttributesFromFields(family.fields)
  for (const field of family.fields) {
    const stored = editing?.attributes?.[field.key]
    if (stored != null) values[field.key] = toFormValue(field, stored)
  }
  return values
}

/** Required fields that are blank on a stored asset (legacy); they never block an edit. */
export function legacyBlankRequiredKeys(editing: AdminRentalAsset | null, families: readonly AssetFamily[]): ReadonlySet<string> {
  const family = families.find((candidate) => candidate.id === editing?.familyId)
  if (!editing || !family?.fields) return new Set()
  return new Set(
    family.fields
      .filter((field) => field.required && !attributeToInputString(editing.attributes?.[field.key]).trim())
      .map((field) => field.key),
  )
}

export function buildRentalResourceFormValues(
  editing: AdminRentalAsset | null,
  units: readonly Unit[],
  categories: readonly RegistryCategoryListItem[],
  families: readonly AssetFamily[],
): RentalResourceFormValues {
  const rentalType = editing?.type === "Good" ? "Good" : "Location"
  const familyId = editing?.familyId ?? pickSingleId(families)
  const family = families.find((candidate) => candidate.id === familyId)

  return {
    name: editing?.name ?? "",
    tag: editing?.tag ?? "",
    unitId: editing?.unitId ?? pickSingleId(units),
    categoryId: editing?.categoryId ?? pickSingleId(categories),
    familyId,
    rentalType,
    totalQuantity: editing?.totalQuantity ?? 1,
    requiresDeposit: editing?.requiresDeposit ?? true,
    queueEnabled: rentalType === "Location" ? (editing?.queueEnabled ?? false) : false,
    queueOpeningTime: toHtmlTimeInput(editing?.queueOpeningTime),
    location: editing?.location ?? "",
    cancelCutoffMode:
      editing?.cancelCutoffHours === 0 ? "none" : typeof editing?.cancelCutoffHours === "number" ? "hours" : "inherit",
    cancelCutoffHours:
      typeof editing?.cancelCutoffHours === "number" && editing.cancelCutoffHours > 0
        ? String(editing.cancelCutoffHours)
        : "",
    cancelCutoffStored: editing?.cancelCutoffHours,
    horizonMode:
      typeof editing?.maxAdvanceBookingDays === "number" ? "days" : "inherit",
    horizonDays:
      typeof editing?.maxAdvanceBookingDays === "number"
        ? String(editing.maxAdvanceBookingDays)
        : "",
    visualTemplateRevisionId: editing?.visualTemplateRevisionId ?? "",
    capacityPeople: String(editing?.capacityPeople ?? ""),
    confirmVisualSuggestions: false,
    // Family fields start empty on create and from the stored values on edit.
    ...(family?.fields ? { attributes: attributesFor(family, editing) } : {}),
  }
}
