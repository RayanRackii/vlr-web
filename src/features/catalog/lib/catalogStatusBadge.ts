import type { CatalogOrder } from "@/features/catalog/schemas/catalogSchemas"

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
