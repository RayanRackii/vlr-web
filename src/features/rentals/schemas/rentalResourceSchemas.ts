import { z } from "zod"

import { guidLikeIdSchema } from "@/features/assets/schemas/assetFamilySchemas"
import { toApiTimeOnly } from "@/features/assets/schemas/assetSchemas"
import {
  cancelCutoffHoursSchema,
  parseCancelCutoffHoursInput,
  resolveCancelCutoffWrite,
  BOOKING_HORIZON_DAY_MAX,
  BOOKING_HORIZON_DAY_MIN,
  parseHorizonDaysInput,
} from "@/features/rentals/schemas/bookingPolicySchemas"

export const rentalTypeValues = ["Location", "Good"] as const

export type RentalType = (typeof rentalTypeValues)[number]

export const registryCategoryListItemSchema = z.object({
  id: guidLikeIdSchema,
  name: z.string().min(1),
})

export type RegistryCategoryListItem = z.infer<
  typeof registryCategoryListItemSchema
>

export const registryCategoryListSchema = z.array(registryCategoryListItemSchema)

export const createRentalCategoryRequestSchema = z.object({
  name: z.string().trim().min(1),
})

export type CreateRentalCategoryRequest = z.infer<
  typeof createRentalCategoryRequestSchema
>

export const createRentableRequestSchema = z.object({
  name: z.string().trim().min(1),
  cancelCutoffHours: cancelCutoffHoursSchema,
  unitId: guidLikeIdSchema,
  categoryId: guidLikeIdSchema,
  familyId: guidLikeIdSchema,
  rentalType: z.enum(rentalTypeValues),
  totalQuantity: z.number().int().min(1),
  requiresDeposit: z.boolean(),
  queueEnabled: z.boolean(),
  queueOpeningTime: z.string().nullable(),
  location: z.string().nullable(),
  /**
   * Absent keeps the stored override (and, on create, inherits the tenant).
   * Null clears a stored override so the resource inherits the tenant policy.
   * A number replaces the override. A resource cannot store unlimited on its own.
   */
  maxAdvanceBookingDays: z
    .number()
    .int()
    .min(BOOKING_HORIZON_DAY_MIN)
    .max(BOOKING_HORIZON_DAY_MAX)
    .nullable()
    .optional(),
  visualTemplateRevisionId: guidLikeIdSchema.nullable().optional(),
  capacityPeople: z.number().int().positive().nullable().optional(),
  confirmVisualSuggestions: z.boolean().optional(),
})

export type CreateRentableRequest = z.infer<typeof createRentableRequestSchema>

export const resourceHorizonModes = ["inherit", "unlimited", "days"] as const

export type ResourceHorizonMode = (typeof resourceHorizonModes)[number]

export function createRentalResourceFormSchema(messages: {
  nameRequired: string
  unitRequired: string
  categoryRequired: string
  familyRequired: string
  quantityMin: string
  queueOpeningTimeRequired: string
  horizonRange: string
  cancelCutoffRange?: string
}) {
  return z
    .object({
      name: z.string().trim().min(1, messages.nameRequired),
      // RentalAssetResponse does not expose the registry tag, so this UI-only
      // value must remain optional and cannot be sent back on an edit.
      tag: z.string(),
      unitId: guidLikeIdSchema.min(1, messages.unitRequired),
      categoryId: guidLikeIdSchema.min(1, messages.categoryRequired),
      familyId: z
        .string()
        .min(1, messages.familyRequired)
        .regex(
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
          messages.familyRequired,
        ),
      rentalType: z.enum(rentalTypeValues),
      totalQuantity: z.number().int().min(1, messages.quantityMin),
      requiresDeposit: z.boolean(),
      queueEnabled: z.boolean(),
      queueOpeningTime: z.string(),
      location: z.string(),
      cancelCutoffMode: z.enum(["inherit", "none", "hours"]).optional(),
      cancelCutoffHours: z.string().optional(),
      // Loaded override travels with the form so unchanged writes stay omitted.
      cancelCutoffStored: cancelCutoffHoursSchema,
      horizonMode: z.enum(resourceHorizonModes),
      horizonDays: z.string(),
      visualTemplateRevisionId: z.string(),
      capacityPeople: z.string(),
      confirmVisualSuggestions: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (values.cancelCutoffMode === "hours" && parseCancelCutoffHoursInput(values.cancelCutoffHours ?? "") === null) {
        ctx.addIssue({ code: "custom", path: ["cancelCutoffHours"], message: messages.cancelCutoffRange })
      }
      if (
        values.rentalType === "Location" &&
        values.queueEnabled &&
        values.queueOpeningTime.trim().length === 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["queueOpeningTime"],
          message: messages.queueOpeningTimeRequired,
        })
      }

      if (
        values.horizonMode === "days" &&
        parseHorizonDaysInput(values.horizonDays) === null
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["horizonDays"],
          message: messages.horizonRange,
        })
      }
    })
}

export type RentalResourceFormValues = z.infer<
  ReturnType<typeof createRentalResourceFormSchema>
>

export type ResourceHorizonWriteContext = {
  creating: boolean
  stored: number | null | undefined
  storedVisualTemplateRevisionId?: string | null
  storedCapacityPeople?: number | null
}

/**
 * Create accepts `int?` (omitted and null both inherit).
 * Update is JsonOptional: omitted keeps the stored override, null clears it
 * (inherit), and a number replaces it.
 *
 * Unlimited sends explicit null. That clears a stored override; the resource
 * then follows the tenant policy. The horizon in effect is unlimited only
 * when that policy has no cap.
 * Use tenant default omits the field when the resource already inherits.
 * Clearing a stored number also sends null, because omit would keep it.
 */
export function resolveResourceHorizonWrite(
  mode: ResourceHorizonMode,
  daysInput: string,
  context: ResourceHorizonWriteContext,
): number | null | undefined {
  if (mode === "days") {
    const days = parseHorizonDaysInput(daysInput)
    if (days === null) {
      throw new Error("Booking horizon is invalid.")
    }
    if (!context.creating && context.stored === days) {
      return undefined
    }
    return days
  }

  if (mode === "unlimited") {
    return null
  }

  if (context.creating || context.stored == null) {
    return undefined
  }

  return null
}

export function toCreateRentableRequest(
  values: RentalResourceFormValues,
  horizon: ResourceHorizonWriteContext = { creating: true, stored: undefined },
): CreateRentableRequest {
  const isLocation = values.rentalType === "Location"
  const payload: CreateRentableRequest = {
    name: values.name.trim(),
    unitId: values.unitId,
    categoryId: values.categoryId,
    familyId: values.familyId,
    rentalType: values.rentalType,
    totalQuantity: isLocation ? 1 : values.totalQuantity,
    requiresDeposit: values.requiresDeposit,
    queueEnabled: isLocation ? values.queueEnabled : false,
    queueOpeningTime:
      isLocation && values.queueEnabled
        ? toApiTimeOnly(values.queueOpeningTime)
        : null,
    location: values.location.trim() ? values.location.trim() : null,
  }
  const cutoff = resolveResourceCancelCutoffWrite(values.cancelCutoffMode, values.cancelCutoffHours, values.cancelCutoffStored)
  if (cutoff !== undefined) payload.cancelCutoffHours = cutoff
  const horizonWrite = resolveResourceHorizonWrite(
    values.horizonMode,
    values.horizonDays,
    horizon,
  )
  if (horizonWrite !== undefined) {
    payload.maxAdvanceBookingDays = horizonWrite
  }
  if (values.visualTemplateRevisionId.trim()) {
    payload.visualTemplateRevisionId = values.visualTemplateRevisionId
  } else if (!horizon.creating && horizon.storedVisualTemplateRevisionId != null) {
    // UpdateRentable uses JsonOptional: omission retains the old assignment.
    payload.visualTemplateRevisionId = null
  }
  if (values.capacityPeople.trim()) {
    payload.capacityPeople = Number(values.capacityPeople)
  } else if (!horizon.creating && horizon.storedCapacityPeople != null) {
    // Same PATCH semantics as the visual template assignment.
    payload.capacityPeople = null
  }
  if (values.confirmVisualSuggestions) {
    payload.confirmVisualSuggestions = true
  }
  return createRentableRequestSchema.parse(payload)
}

/**
 * Resource layer: null inherits (category, then tenant); an explicit 0 overrides any inherited
 * cutoff with "no cutoff" (PolicyResolver: resource ?? category ?? tenant; 0 => no deadline).
 */
export function resolveResourceCancelCutoffWrite(
  mode: "inherit" | "none" | "hours" | undefined,
  input: string | undefined,
  stored: number | null | undefined,
): number | null | undefined {
  if (mode === "none") return stored === 0 ? undefined : 0
  return resolveCancelCutoffWrite(mode, input, stored)
}
