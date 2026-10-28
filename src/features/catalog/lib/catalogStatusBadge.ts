import type { CatalogOrder } from "@/features/catalog/schemas/catalogSchemas"
import type { PortalStatusTone } from "@/features/catalog/components/PortalStatusChip"

type CatalogStatusBadgeVariant =
  | "success"
  | "destructive"
  | "secondary"
  | "warning"
  | "outline"

/** Maps a catalog order status to the Badge variant used across the B2C portal. */
export function catalogOrderStatusBadgeVariant(
  status: CatalogOrder["status"],
): CatalogStatusBadgeVariant {
  switch (status) {
    case "Completed":
    case "Ready":
      return "success"
    case "Rejected":
    case "Cancelled":
      return "destructive"
    case "Requested":
      return "warning"
    default:
      return "outline"
  }
}

/** Maps a product-request status string to the Badge variant used across the B2C portal. */
export function productRequestStatusBadgeVariant(
  status: string,
): "destructive" | "outline" {
  return status.trim().toLowerCase() === "cancelled" ? "destructive" : "outline"
}

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
