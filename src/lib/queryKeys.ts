export type QueryAudience = "staff" | "customer"

/**
 * Every query key starts with the audience and the tenant so cached data can never be served to
 * another tenant or to the other kind of session (staff JWT vs customer portal token).
 * `null`/`undefined` (no tenant yet, platform admin outside a tenant) maps to "none".
 */
export function tenantKey(audience: QueryAudience, tenantId: string | null | undefined, ...parts: readonly unknown[]) {
  return ["tenant", audience, tenantId?.trim() || "none", ...parts] as const
}
