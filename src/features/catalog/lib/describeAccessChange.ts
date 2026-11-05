import type { CatalogAuditEntry } from "@/features/catalog/schemas/catalogSchemas"

type AccessSnapshot = { visibility?: string; groupIds?: string[]; customerIds?: string[] }

function parseSnapshot(json: string | null): AccessSnapshot | null {
  if (!json) {
    return null
  }
  try {
    const value: unknown = JSON.parse(json)
    return value && typeof value === "object" ? (value as AccessSnapshot) : null
  } catch {
    return null
  }
}

/** Human summary of an access change from the audit snapshots (names only; unknown groups are counted). */
export function describeAccessChange(
  entry: CatalogAuditEntry,
  groupNames: Record<string, string>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (entry.action !== "product.accessChanged") {
    return null
  }
  const after = parseSnapshot(entry.afterJson)
  if (!after) {
    return null
  }
  const before = parseSnapshot(entry.beforeJson)
  const parts: string[] = [
    t(after.visibility === "Restricted" ? "catalog.products.access.restricted" : "catalog.products.access.public"),
  ]
  const beforeGroups = new Set(before?.groupIds ?? [])
  const afterGroups = new Set(after.groupIds ?? [])
  const name = (id: string) => groupNames[id] ?? t("catalog.products.access.history.unknownGroup")
  const added = [...afterGroups].filter((id) => !beforeGroups.has(id)).map(name)
  const removed = [...beforeGroups].filter((id) => !afterGroups.has(id)).map(name)
  if (added.length > 0) {
    parts.push(t("catalog.products.access.history.groupsAdded", { names: added.join(", ") }))
  }
  if (removed.length > 0) {
    parts.push(t("catalog.products.access.history.groupsRemoved", { names: removed.join(", ") }))
  }
  const customers = after.customerIds?.length ?? 0
  if (after.visibility === "Restricted") {
    parts.push(t("catalog.products.access.history.customers", { count: customers }))
  }
  return parts.join(" · ")
}
