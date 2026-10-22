import { toHtmlTimeInput } from "@/features/assets/schemas/assetSchemas"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
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

export function buildRentalResourceFormValues(
  editing: AdminRentalAsset | null,
  units: readonly Unit[],
  categories: readonly RegistryCategoryListItem[],
  families: readonly AssetFamily[],
): RentalResourceFormValues {
  const rentalType = editing?.type === "Good" ? "Good" : "Location"

  return {
    name: editing?.name ?? "",
    tag: "",
    unitId: editing?.unitId ?? pickSingleId(units),
    categoryId: editing?.categoryId ?? pickSingleId(categories),
    familyId: pickSingleId(families),
    rentalType,
    totalQuantity: editing?.totalQuantity ?? 1,
    requiresDeposit: editing?.requiresDeposit ?? true,
    queueEnabled: rentalType === "Location" ? (editing?.queueEnabled ?? false) : false,
    queueOpeningTime: toHtmlTimeInput(editing?.queueOpeningTime),
    location: "",
    horizonMode:
      typeof editing?.maxAdvanceBookingDays === "number" ? "days" : "inherit",
    horizonDays:
      typeof editing?.maxAdvanceBookingDays === "number"
        ? String(editing.maxAdvanceBookingDays)
        : "",
    visualTemplateRevisionId: editing?.visualTemplateRevisionId ?? "",
    capacityPeople: editing?.capacityPeople?.toString() ?? "",
    confirmVisualSuggestions: false,
  }
}
