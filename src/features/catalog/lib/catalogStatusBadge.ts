import type { CatalogOrder } from "@/features/catalog/schemas/catalogSchemas"
import type { PortalStatusTone } from "@/features/catalog/components/PortalStatusChip"

/** Maps a catalog order status to the portal status-chip tone. */
export function catalogOrderStatusTone(
  status: CatalogOrder["status"],
): PortalStatusTone {
  switch (status) {
    case "Completed":
    case "Ready":
      return "success"
    case "Rejected":
    case "Cancelled":
      return "danger"
    case "Requested":
      return "warning"
    default:
      // Approved, Preparing — work is underway.
      return "info"
  }
}

/** Maps a product-request status string to the portal status-chip tone. */
export function productRequestStatusTone(status: string): PortalStatusTone {
  return status.trim().toLowerCase() === "cancelled" ? "danger" : "info"
}

/** Shared staff list/detail tones, including muted cancelled orders. */
export const STAFF_ORDER_STATUS_TONE: Record<CatalogOrder["status"], string> = {
  Requested: "warning", Approved: "info", Preparing: "info", Ready: "success",
  Completed: "success", Rejected: "danger", Cancelled: "muted",
}
