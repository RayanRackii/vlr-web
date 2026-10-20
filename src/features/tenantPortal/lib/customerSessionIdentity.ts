export const CUSTOMER_TOKEN_STORAGE_KEY = "rolvix.customer.token"
export const CUSTOMER_SUBDOMAIN_STORAGE_KEY = "rolvix.customer.subdomain"
export const CUSTOMER_LABEL_STORAGE_KEY = "rolvix.customer.label"
export const CUSTOMER_ID_STORAGE_KEY = "rolvix.customer.id"
export const CUSTOMER_TENANT_ID_STORAGE_KEY = "rolvix.customer.tenantId"

function tokenFingerprint(token: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * A stable identity for UI state that must not cross Customer sessions.
 * Prefer the durable Customer id so token refreshes preserve that UI state;
 * old sessions without an id use a fingerprint instead of exposing the token.
 */
export function currentCustomerSessionIdentity(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const customerId = window.localStorage.getItem(CUSTOMER_ID_STORAGE_KEY)?.trim()
  if (customerId) {
    return `customer:${customerId}`
  }

  const token = window.localStorage.getItem(CUSTOMER_TOKEN_STORAGE_KEY)
  return token && token.length > 0 ? `token:${tokenFingerprint(token)}` : null
}
