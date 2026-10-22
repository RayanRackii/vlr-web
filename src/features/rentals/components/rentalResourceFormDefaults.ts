import { toHtmlTimeInput } from "@/features/assets/schemas/assetSchemas"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import type {
  RegistryCategoryListItem,
  RentalResourceFormValues,
} from "@/features/rentals/schemas/rentalResourceSchemas"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"

function pickSingleId(items: readonly { id: string }[]): string {
  return items.length === 1 ? (items[0]?.id ?? "") : ""
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
