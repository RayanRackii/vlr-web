import { z } from "zod"

/**
 * Proposed staff read of one item's queue session.
 * The customer `GET /api/rental-assets/{id}/queue` returns only `myTicket`
 * and must stay a customer contract. This DTO is the staff roster.
 */
export const staffQueuePhaseSchema = z.enum(["Closed", "WaitingRoom", "Open"])

export const staffQueueTicketStatusSchema = z.enum([
  "Waiting",
  "Active",
  "Completed",
  "Expired",
  "Cancelled",
])

export const staffQueueTicketSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string().nullable().optional().default(null),
  status: staffQueueTicketStatusSchema,
  sequence: z.coerce.number().int(),
  position: z.coerce.number().int(),
  joinedAt: z.string(),
  turnStartedAt: z.string().nullable().optional().default(null),
  turnExpiresAt: z.string().nullable().optional().default(null),
  completedReservationId: z.string().uuid().nullable().optional().default(null),
})

export const staffResourceQueueSchema = z.object({
  rentalAssetId: z.string().uuid(),
  queueEnabled: z.boolean(),
  openingDate: z.string().nullable().optional().default(null),
  opensAt: z.string().nullable().optional().default(null),
  waitingRoomOpensAt: z.string().nullable().optional().default(null),
  serverNow: z.string(),
  phase: staffQueuePhaseSchema,
  waitingCount: z.coerce.number().int().nonnegative(),
  activeCount: z.coerce.number().int().nonnegative().optional().default(0),
  tickets: z.array(staffQueueTicketSchema),
})

export type StaffQueueTicket = z.infer<typeof staffQueueTicketSchema>
export type StaffResourceQueue = z.infer<typeof staffResourceQueueSchema>

export function staffResourceQueuePath(
  rentalAssetId: string,
  openingDate?: string,
): string {
  const base = `/api/rentals/rental-assets/${encodeURIComponent(rentalAssetId)}/queue`
  if (!openingDate) {
    return base
  }
  return `${base}?openingDate=${encodeURIComponent(openingDate)}`
}
