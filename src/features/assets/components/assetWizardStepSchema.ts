import { z } from "zod"

import {
  emptyPricingEditor,
  isPricingEditorValid,
  type PricingEditorState,
} from "@/features/assets/components/assetWizardPricing"
import {
  buildAttributesZodSchema,
  guidLikeIdSchema,
  type AssetFamilyField,
} from "@/features/assets/schemas/assetFamilySchemas"
import { toApiTimeOnly } from "@/features/assets/schemas/assetSchemas"

export type AssetWizardMode = "create" | "bulk" | "edit"

export type AssetWizardStepInput = {
  mode: AssetWizardMode
  rentalType: "Location" | "Good"
  unitId: string
  categoryId: string
  familyId: string
  name: string
  tag: string
  baseLocationName: string
  baseTag: string
  startNumber: number
  endNumber: number
  totalQuantity: number
  attributes: Record<string, string>
  familyFields: readonly AssetFamilyField[]
  isRentable: boolean
  queueEnabled: boolean
  queueOpeningTime: string
  pricing: PricingEditorState
}

const requiredText = z.string().trim().min(1)
const finiteNumber = z.number().refine((value) => Number.isFinite(value))

function generalStepSchema(
  mode: AssetWizardMode,
  rentalType: "Location" | "Good",
  familyFields: readonly AssetFamilyField[],
): z.ZodType<unknown> {
  const shared = {
    unitId: guidLikeIdSchema,
    categoryId: guidLikeIdSchema,
    familyId: guidLikeIdSchema,
    attributes: buildAttributesZodSchema(familyFields),
  }

  if (mode === "bulk" && rentalType === "Location") {
    return z
      .object({
        ...shared,
        baseLocationName: requiredText,
        baseTag: requiredText,
        startNumber: finiteNumber,
        endNumber: finiteNumber,
      })
      .refine((value) => value.startNumber <= value.endNumber)
  }

  if (mode === "bulk") {
    return z.object({
      ...shared,
      baseLocationName: requiredText,
      baseTag: requiredText,
      totalQuantity: finiteNumber.refine((value) => value >= 1),
    })
  }

  return z.object({
    ...shared,
    name: requiredText,
    tag: requiredText,
  })
}

function generalValues(input: AssetWizardStepInput) {
  const shared = {
    unitId: input.unitId,
    categoryId: input.categoryId,
    familyId: input.familyId,
    attributes: input.attributes,
  }

  if (input.mode === "bulk" && input.rentalType === "Location") {
    return {
      ...shared,
      baseLocationName: input.baseLocationName,
      baseTag: input.baseTag,
      startNumber: input.startNumber,
      endNumber: input.endNumber,
    }
  }

  if (input.mode === "bulk") {
    return {
      ...shared,
      baseLocationName: input.baseLocationName,
      baseTag: input.baseTag,
      totalQuantity: input.totalQuantity,
    }
  }

  return {
    ...shared,
    name: input.name,
    tag: input.tag,
  }
}

export const assetWizardOperationStepSchema = z
  .object({
    mode: z.enum(["create", "bulk", "edit"]),
    isRentable: z.boolean(),
    rentalType: z.enum(["Location", "Good"]),
    totalQuantity: z.unknown(),
    queueEnabled: z.boolean(),
    queueOpeningTime: z.string(),
  })
  .superRefine((value, ctx) => {
    if (!value.isRentable) {
      return
    }

    const quantity = value.totalQuantity
    if (
      value.mode !== "bulk" &&
      (typeof quantity !== "number" ||
        !Number.isFinite(quantity) ||
        quantity < 1)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["totalQuantity"],
      })
    }

    if (
      value.rentalType === "Location" &&
      value.queueEnabled &&
      toApiTimeOnly(value.queueOpeningTime) == null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["queueOpeningTime"],
      })
    }
  })

export const assetWizardPricingStepSchema = z.custom<PricingEditorState>(
  (value) => {
    if (typeof value !== "object" || value === null) {
      return false
    }

    return isPricingEditorValid(value as PricingEditorState)
  },
)

function operationValues(input: AssetWizardStepInput) {
  return {
    mode: input.mode,
    isRentable: input.isRentable,
    rentalType: input.rentalType,
    totalQuantity: input.totalQuantity,
    queueEnabled: input.queueEnabled,
    queueOpeningTime: input.queueOpeningTime,
  }
}

function reviewStepSchema(input: AssetWizardStepInput) {
  return z.object({
    general: generalStepSchema(
      input.mode,
      input.rentalType,
      input.familyFields,
    ),
    operation: assetWizardOperationStepSchema,
    pricing: input.isRentable ? assetWizardPricingStepSchema : z.unknown(),
  })
}

export function isAssetWizardStepValid(
  stepId: string,
  input: AssetWizardStepInput,
): boolean {
  if (stepId === "general") {
    return generalStepSchema(
      input.mode,
      input.rentalType,
      input.familyFields,
    ).safeParse(generalValues(input)).success
  }

  if (stepId === "operation") {
    return assetWizardOperationStepSchema.safeParse(operationValues(input))
      .success
  }

  if (stepId === "pricing") {
    return assetWizardPricingStepSchema.safeParse(input.pricing).success
  }

  if (stepId === "review") {
    return reviewStepSchema(input).safeParse({
      general: generalValues(input),
      operation: operationValues(input),
      pricing: input.pricing,
    }).success
  }

  return false
}

export function emptyAssetWizardStepInput(
  patch: Partial<AssetWizardStepInput> = {},
): AssetWizardStepInput {
  return {
    mode: "create",
    rentalType: "Location",
    unitId: "",
    categoryId: "",
    familyId: "",
    name: "",
    tag: "",
    baseLocationName: "",
    baseTag: "",
    startNumber: 1,
    endNumber: 1,
    totalQuantity: 1,
    attributes: {},
    familyFields: [],
    isRentable: false,
    queueEnabled: false,
    queueOpeningTime: "",
    pricing: emptyPricingEditor(),
    ...patch,
  }
}
