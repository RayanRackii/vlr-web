import type { TFunction } from "i18next"

type OrderHistoryMessage = {
  messageKey?: string | null
  messageParams?: Record<string, string> | null
}

/**
 * Title of an order timeline entry. Resolves the API `messageKey` in the user's language
 * (with `messageParams` as interpolation values) and falls back to `fallback` when the key
 * is absent or has no translation yet.
 */
export function describeOrderHistoryEntry(entry: OrderHistoryMessage, t: TFunction, fallback: string): string {
  if (!entry.messageKey) return fallback
  return t(entry.messageKey, { ...(entry.messageParams ?? {}), defaultValue: fallback })
}
