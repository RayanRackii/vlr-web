import {
  formatAttributeValue,
  toFormValue,
} from "@/features/assets/lib/assetAttributeValues"
import type { AssetFamilyField } from "@/features/assets/schemas/assetFamilySchemas"
import type { AssetAttributeValue } from "@/features/assets/schemas/assetSchemas"

export type AssetAttributeChip = { id: string; text: string; title: string }

/** The list never shows more than this many chips; the rest collapse into a "+N" count. */
export const MAX_LIST_CHIPS = 3

const CHIP_TYPES = new Set(["select", "multiselect", "number"])

/** Returns the http(s) URL, or null for anything else (javascript:, data:, relative, malformed). */
export function toSafeHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim())
    return url.protocol === "http:" || url.protocol === "https:" ? url : null
  } catch {
    return null
  }
}

export function isAbsentAttribute(value: AssetAttributeValue | undefined): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim() === ""
  return Array.isArray(value) && value.length === 0
}

/** Numeric value of a number field (typed or legacy string), or null when it is not numeric. */
export function numericAttribute(value: AssetAttributeValue | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null
  // Dot-decimal only: a legacy "1,000" is ambiguous, so it is never merged into a joined value.
  const text = value.trim()
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null
}

/**
 * Compact chips for the equipment list: values of the first select, multiselect and number
 * fields that have a value. Archived fields and unknown keys are ignored.
 */
export function listAttributeChips(
  fields: readonly AssetFamilyField[],
  attributes: Readonly<Record<string, AssetAttributeValue>>,
  locale: string,
  labelOf?: (field: AssetFamilyField) => string,
): { chips: AssetAttributeChip[]; hidden: number } {
  const all: AssetAttributeChip[] = []
  for (const field of fields) {
    if (field.archived || !CHIP_TYPES.has(field.type)) continue
    const stored = attributes[field.key]
    if (isAbsentAttribute(stored)) continue
    const label = labelOf?.(field) ?? (field.label?.trim() || field.key)
    if (field.type === "multiselect") {
      for (const item of toFormValue(field, stored) as string[]) {
        all.push({ id: `${field.key}:${item}`, text: item, title: `${label}: ${item}` })
      }
      continue
    }
    const text = formatAttributeValue(field, stored, locale)
    if (text) all.push({ id: field.key, text, title: `${label}: ${text}` })
  }
  return { chips: all.slice(0, MAX_LIST_CHIPS), hidden: Math.max(0, all.length - MAX_LIST_CHIPS) }
}
