import { z } from "zod"
import { pricingUnitSchema } from "@/api/generated/rentalPricing"
import { guidLikeIdSchema } from "@/features/assets/schemas/assetFamilySchemas"

// Catalog IDs are deterministic GUIDs generated from hashes; they do not
// necessarily carry RFC 4122 version and variant bits.
const uuid = guidLikeIdSchema
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const i18nText = z.record(z.string(), z.string().nullable())

export const visualTagSchema = z.object({ id: uuid, slug: z.string(), kind: z.enum(["Segment", "Attribute"]), facet: z.string(), nameI18n: i18nText, isActive: z.boolean(), sortOrder: z.number() })
export const visualRevisionSchema = z.object({ id: uuid, templateId: uuid, revisionNo: z.number(), status: z.enum(["Draft", "Published"]), viewBox: z.string(), aspectRatio: z.coerce.number(), defaultColor: hexColor, defaultIcon: z.string(), suggestedSlotMinutes: z.number().nullable(), suggestedCapacityPeople: z.number().nullable(), defaultSchedulePolicy: z.enum(["SlotGrid", "OpenHours"]).nullable().optional(), defaultOpenTime: z.string().nullable().optional(), defaultCloseTime: z.string().nullable().optional(), defaultAllowedDurationMinutes: z.number().int().positive().nullable().optional(), defaultPricings: z.array(z.unknown()).nullable().optional(), defaultRequiresDeposit: z.boolean().nullable().optional(), defaultMaxAdvanceBookingDays: z.number().int().min(0).max(3650).nullable().optional(), artSha256: z.string(), artUrl: z.string().nullable(), version: z.number() })
export const visualTemplateSchema = z.object({ id: uuid, slug: z.string(), nameI18n: i18nText, descriptionI18n: i18nText, isActive: z.boolean(), sortOrder: z.number(), version: z.number(), tags: z.array(visualTagSchema), publishedRevision: visualRevisionSchema.nullable() })
export const visualPageSchema = z.object({ items: z.array(visualTemplateSchema), total: z.number(), page: z.number(), pageSize: z.number(), filterSemantics: z.string() })

export const mapItemSchema = z.object({ id: uuid, rentalAssetId: uuid, assetName: z.string(), xPercent: z.coerce.number(), yPercent: z.coerce.number(), widthPercent: z.coerce.number(), heightPercent: z.coerce.number(), zIndex: z.number(), rotation: z.number().default(0), lockAspectRatio: z.boolean().default(true), visualTemplateRevisionId: uuid.nullable(), capacityPeople: z.number().nullable() })
export const mapDecorationSchema = z.object({ id: uuid, kind: z.enum(["Walkway", "Label", "Landmark", "Shape"]), label: z.string().nullable(), iconKey: z.string().nullable(), xPercent: z.coerce.number(), yPercent: z.coerce.number(), widthPercent: z.coerce.number(), heightPercent: z.coerce.number(), rotation: z.number(), zIndex: z.number(), style: z.record(z.string(), z.unknown()), geometry: z.record(z.string(), z.unknown()).nullable() })
export const mapCompositionSchema = z.object({ id: uuid, unitId: uuid.nullable(), name: z.string(), isActive: z.boolean(), sortOrder: z.number(), aspectRatio: z.coerce.number(), widthPercent: z.coerce.number(), version: z.number(), items: z.array(mapItemSchema), decorations: z.array(mapDecorationSchema) })
export const bookingMapSettingsSchema = z.object({ availableColor: hexColor, takenColor: hexColor, unavailableColor: hexColor, selectedColor: hexColor, showPriceOnBlock: z.boolean(), timeFilterMode: z.enum(["Periods", "FromTime"]), defaultView: z.enum(["Map", "List"]), defaultLayoutId: uuid.nullable(), version: z.number() })
export const publicMapSummarySchema = z.object({ id: uuid, unitId: uuid.nullable(), name: z.string(), aspectRatio: z.coerce.number(), widthPercent: z.coerce.number(), sortOrder: z.number(), version: z.number() })
export const publicMapListSchema = z.object({ maps: z.array(publicMapSummarySchema), defaultLayoutId: uuid.nullable(), settings: bookingMapSettingsSchema })
export const publicVisualRevisionSchema = z.object({ id: uuid, templateId: uuid, revisionNo: z.number(), floorSvg: z.string(), linesSvg: z.string().nullable(), netSvg: z.string().nullable(), viewBox: z.string(), aspectRatio: z.coerce.number(), defaultColor: hexColor, defaultIcon: z.string(), artSha256: z.string() })
/**
 * The public endpoint intentionally does not expose admin-only map fields
 * (`isActive` and `sortOrder`). Keep its contract separate from the editor
 * composition so a valid public map never falls back to the legacy picker.
 */
export const publicMapSchema = z.object({
  id: uuid,
  unitId: uuid.nullable(),
  name: z.string(),
  aspectRatio: z.coerce.number(),
  widthPercent: z.coerce.number(),
  version: z.number(),
  items: z.array(mapItemSchema),
  decorations: z.array(mapDecorationSchema),
  visualRevisions: z.array(publicVisualRevisionSchema),
})
export const dailyAvailabilitySchema = z.object({ date: z.string(), timeZone: z.string(), serverNow: z.string(), quoteExpiresAt: z.string(), currency: z.string(), resources: z.array(z.object({ rentalAssetId: uuid, assetId: uuid, unitId: uuid, name: z.string(), type: z.string(), totalQuantity: z.number(), requiresDeposit: z.boolean(), queueEnabled: z.boolean(), effectiveMaxAdvanceBookingDays: z.number().nullable(), windows: z.array(z.object({ slotId: uuid.nullable(), startTime: z.string(), endTime: z.string(), isDerived: z.boolean(), state: z.enum(["Available", "Taken", "Blocked", "Past", "OutsideHorizon", "Unpriced"]), reasonCode: z.string().nullable(), availableQuantity: z.number(), totalAmount: z.number().nullable(), pricingUnit: pricingUnitSchema.nullish() })) })) })

export type VisualTag = z.infer<typeof visualTagSchema>
export type VisualTemplate = z.infer<typeof visualTemplateSchema>
export type VisualRevision = z.infer<typeof visualRevisionSchema>
export type MapComposition = z.infer<typeof mapCompositionSchema>
export type BookingMapSettings = z.infer<typeof bookingMapSettingsSchema>
export type PublicMap = z.infer<typeof publicMapSchema>
export type DailyAvailability = z.infer<typeof dailyAvailabilitySchema>
