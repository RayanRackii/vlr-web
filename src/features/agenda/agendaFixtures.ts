import type { AdminDaySlot } from "@/features/rentals/services/scheduleService"
import { rentalAssetSchema } from "@/features/rentals/services/scheduleService"
import { catalogAgendaItemSchema } from "@/features/catalog/schemas/catalogSchemas"
import type { AgendaDaySources } from "./dayGridModel"

export const asset = rentalAssetSchema.parse({ id: "11111111-1111-4111-8111-111111111111", assetId: "11111111-1111-4111-8111-111111111112", unitId: "11111111-1111-4111-8111-111111111113", name: "Estúdio A", isActive: true, categoryId: "11111111-1111-4111-8111-111111111114", openTime: "06:00:00", closeTime: "23:00:00" })
export const order = catalogAgendaItemSchema.parse({ orderId: "22222222-2222-4222-8222-222222222222", displayNumber: "#42", orderStatus: "Requested", productId: "22222222-2222-4222-8222-222222222223", productName: "Podcast", rentalAssetId: asset.id, resourceName: asset.name, customerName: "Ana", occupiedStart: "2026-11-10T12:00:00Z", occupiedEnd: "2026-11-10T15:00:00Z", workStart: "2026-11-10T13:00:00Z", workEnd: "2026-11-10T14:00:00Z", allocationStatus: null, timeZoneId: "America/Sao_Paulo" })
export function slot(patch: Partial<AdminDaySlot> = {}): AdminDaySlot {
  return { id: "slot", rentalAssetId: asset.id, assetName: asset.name, date: "2026-11-10", startTime: "09:00:00", endTime: "12:00:00", occupancyKindId: "kind", occupancyKindKey: "closed", occupancyKindLabel: "Fechado", isBookableByCustomer: false, status: "Available", isDerived: false, source: "DailyOverride", schedulePolicy: "SlotGrid", supportsEntireRecurrence: false, ...patch }
}
export function sources(patch: Partial<AgendaDaySources> = {}): AgendaDaySources {
  return { assets: [asset], catalog: { resources: [], items: [] }, reservations: [], slots: [], kinds: [], ...patch }
}
