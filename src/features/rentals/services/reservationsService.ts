import { z } from "zod"

import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"

export const reservationStatuses = [
  "PendingDeposit",
  "Confirmed",
  "Canceled",
  "Completed",
] as const

export type ReservationStatus = (typeof reservationStatuses)[number]

const reservationItemSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string().uuid(),
  rentalAssetId: z.string().uuid(),
  assetName: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  subTotal: z.number(),
})

const reservationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  unitId: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  customerWhatsApp: z.string(),
  startDateTime: z.string(),
  endDateTime: z.string(),
  status: z.enum(reservationStatuses),
  totalAmount: z.number(),
  depositPaid: z.number(),
  createdAt: z.string(),
  items: z.array(reservationItemSchema),
})

export type AdminReservation = z.infer<typeof reservationSchema>

export type ListAdminReservationsQuery = {
  from?: string
  to?: string
  status?: ReservationStatus | ""
  assetId?: string
}

export async function listAdminReservations(
  query: ListAdminReservationsQuery = {},
): Promise<AdminReservation[]> {
  try {
    const response = await api.get("/api/reservations", {
      params: {
        from: query.from || undefined,
        to: query.to || undefined,
        status: query.status || undefined,
        assetId: query.assetId || undefined,
      },
    })
    const parsed = z.array(reservationSchema).safeParse(response.data)
    if (!parsed.success) {
      throw new Error("Invalid reservations payload.")
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(getAxiosErrorPayload(error), "Could not load reservations."),
    )
  }
}

export async function confirmAdminReservation(
  id: string,
): Promise<AdminReservation> {
  try {
    const response = await api.post(`/api/reservations/${id}/confirm`)
    const parsed = reservationSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error("Invalid confirm response.")
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        "Could not confirm reservation.",
      ),
    )
  }
}

export async function cancelAdminReservation(
  id: string,
): Promise<AdminReservation> {
  try {
    const response = await api.post(`/api/reservations/${id}/cancel`)
    const parsed = reservationSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error("Invalid cancel response.")
    }
    return parsed.data
  } catch (error) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        "Could not cancel reservation.",
      ),
    )
  }
}

export function formatReservationAssets(reservation: AdminReservation): string {
  if (reservation.items.length === 0) {
    return "—"
  }
  return reservation.items
    .map((item) =>
      item.quantity > 1
        ? `${item.assetName} ×${item.quantity}`
        : item.assetName,
    )
    .join(", ")
}

export function formatReservationRange(
  startDateTime: string,
  endDateTime: string,
): string {
  const start = new Date(startDateTime)
  const end = new Date(endDateTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDateTime} – ${endDateTime}`
  }

  const datePart = start.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const startTime = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
  const endTime = end.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${datePart} ${startTime} – ${endTime}`
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "BRL",
  }).format(amount)
}
