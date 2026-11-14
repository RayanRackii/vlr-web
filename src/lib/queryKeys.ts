/**
 * Every query key starts with the tenant so cached data can never be served to another
 * tenant. `null`/`undefined` (no tenant yet, platform admin outside a tenant) maps to "none".
 */
export function tenantKey(tenantId: string | null | undefined, ...parts: readonly unknown[]) {
  return ["tenant", tenantId?.trim() || "none", ...parts] as const
}
