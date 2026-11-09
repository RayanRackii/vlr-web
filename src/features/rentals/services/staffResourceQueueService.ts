import { api, isAxiosError } from "@/lib/api"
import {
  staffResourceQueuePath,
  staffResourceQueueSchema,
  type StaffResourceQueue,
} from "@/features/rentals/schemas/staffResourceQueueSchemas"

export type StaffQueueRead =
  | { status: "ready"; queue: StaffResourceQueue }
  | { status: "unavailable" }
  | { status: "forbidden" }

/**
 * Staff roster for one item's daily queue.
 * `GET /api/rentals/rental-assets/{id}/queue?openingDate=yyyy-mm-dd`
 * is not on the API yet. 404/405/501 and an unexpected body degrade to
 * `unavailable` instead of inventing tickets. The customer queue route is
 * not called from here.
 */
export async function fetchStaffResourceQueue(
  rentalAssetId: string,
  openingDate?: string,
): Promise<StaffQueueRead> {
  try {
    const response = await api.get<unknown>(
      staffResourceQueuePath(rentalAssetId, openingDate),
    )
    const parsed = staffResourceQueueSchema.safeParse(response.data)
    if (!parsed.success) {
      return { status: "unavailable" }
    }
    return { status: "ready", queue: parsed.data }
  } catch (error: unknown) {
    if (!isAxiosError(error) || !error.response) {
      return { status: "unavailable" }
    }
    const status = error.response.status
    if (status === 401 || status === 403) {
      return { status: "forbidden" }
    }
    return { status: "unavailable" }
  }
}
