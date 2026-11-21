import type { ProductRequest } from "../schemas/catalogSchemas"

/** "Name · e-mail", the one that exists, or "—" when both are empty. Never the customer id. */
export function requestCustomerLabel(request: Pick<ProductRequest, "customerName" | "customerEmail">): string {
  const parts = [request.customerName, request.customerEmail]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
  return parts.length > 0 ? parts.join(" · ") : "—"
}
