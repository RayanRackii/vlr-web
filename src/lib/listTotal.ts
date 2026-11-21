/**
 * Staff list endpoints return at most the newest rows and publish the real count in `X-Total-Count`.
 * The services still return a plain array, so the count travels beside it: `withListTotal` records it
 * for that exact array and `listTotalOf` reads it back (null when the API sent no header).
 */
const totals = new WeakMap<object, number>()

export const LIST_TOTAL_HEADER = "x-total-count"

export function parseListTotal(headers: unknown): number | null {
  if (!headers || typeof headers !== "object") return null
  const record = headers as Record<string, unknown> & { get?: (name: string) => unknown }
  const raw = record[LIST_TOTAL_HEADER] ?? record["X-Total-Count"] ?? (typeof record.get === "function" ? record.get(LIST_TOTAL_HEADER) : undefined)
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(value) && value >= 0 ? value : null
}

export function withListTotal<T extends readonly unknown[]>(rows: T, headers: unknown): T {
  const total = parseListTotal(headers)
  if (total !== null) totals.set(rows, total)
  return rows
}

export function listTotalOf(rows: readonly unknown[]): number | null {
  return totals.get(rows) ?? null
}
