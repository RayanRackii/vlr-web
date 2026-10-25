// generated from openapi/openapi.json; do not edit.
import { z } from "zod"

export const pricingUnitSchema = z.enum(["Hour","Slot","Day","Fixed"])
export const dayOfWeekSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)])
export const availabilityWindowStateSchema = z.enum(["Available","Taken","Blocked","Past","OutsideHorizon","Unpriced"])

export type PricingUnit = z.infer<typeof pricingUnitSchema>

export const availabilityWindowDtoSchema = z.object({
  availableQuantity: z.number().int().optional(),
  endTime: z.string().optional(),
  isDerived: z.boolean().optional(),
  pricingUnit: pricingUnitSchema.nullable().optional(),
  reasonCode: z.string().nullable().optional(),
  slotId: z.string().nullable().optional(),
  startTime: z.string().optional(),
  state: availabilityWindowStateSchema.optional(),
  totalAmount: z.number().nullable().optional(),
})

export type AvailabilityWindowDto = z.infer<typeof availabilityWindowDtoSchema>

export const bulkPricingRowDtoSchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  depositPercentage: z.number(),
  endTime: z.string(),
  pricePerHour: z.number(),
  pricingUnit: pricingUnitSchema.optional(),
  requiresDeposit: z.boolean(),
  startTime: z.string(),
})

export type BulkPricingRowDto = z.infer<typeof bulkPricingRowDtoSchema>

export const checkAvailabilityResponseDtoSchema = z.object({
  availableQuantity: z.number().int().optional(),
  estimatedTotalAmount: z.number().nullable().optional(),
  isAvailable: z.boolean().optional(),
  pricingUnit: pricingUnitSchema.nullable().optional(),
  reason: z.string().nullable().optional(),
  requestedQuantity: z.number().int().optional(),
})

export type CheckAvailabilityResponseDto = z.infer<typeof checkAvailabilityResponseDtoSchema>

export const createRentalPricingDtoSchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  depositPercentage: z.number().optional(),
  endTime: z.string(),
  pricePerHour: z.number(),
  pricingUnit: pricingUnitSchema.optional(),
  requiresDeposit: z.boolean().optional(),
  startTime: z.string(),
})

export type CreateRentalPricingDto = z.infer<typeof createRentalPricingDtoSchema>

export const rentalPricingResponseDtoSchema = z.object({
  assetId: z.string().optional(),
  createdAt: z.string().optional(),
  dayOfWeek: dayOfWeekSchema.optional(),
  depositPercentage: z.number().optional(),
  endTime: z.string().optional(),
  id: z.string().optional(),
  pricePerHour: z.number().optional(),
  pricingUnit: pricingUnitSchema.optional(),
  rentalAssetId: z.string().optional(),
  requiresDeposit: z.boolean().optional(),
  startTime: z.string().optional(),
  tenantId: z.string().optional(),
  updatedAt: z.string().nullable().optional(),
})

export type RentalPricingResponseDto = z.infer<typeof rentalPricingResponseDtoSchema>

export const updateRentalPricingDtoSchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  depositPercentage: z.number(),
  endTime: z.string(),
  pricePerHour: z.number(),
  pricingUnit: pricingUnitSchema.nullable().optional(),
  requiresDeposit: z.boolean(),
  startTime: z.string(),
})

export type UpdateRentalPricingDto = z.infer<typeof updateRentalPricingDtoSchema>
