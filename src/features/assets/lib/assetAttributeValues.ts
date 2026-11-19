import type { AssetFamilyField } from "@/features/assets/schemas/assetFamilySchemas"
import type { AssetAttributeValue } from "@/features/assets/schemas/assetSchemas"

/**
 * Converts a stored attribute value (legacy string or typed JSON) to the string
 * the current form inputs work with.
 */
export function attributeToInputString(
  value: AssetAttributeValue | undefined,
): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  return value.join(", ")
}

/** Value held by a form control: text-like and number fields use strings, boolean a boolean, multiselect an array. */
export type AttributeFormValue = string | boolean | string[]

/** Value sent to the API. Legacy string payloads remain valid server-side. */
export type AttributePayloadValue = string | number | boolean | string[] | null

type FieldShape = Pick<AssetFamilyField, "type" | "options">

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/
const COMMA_NUMBER = /^-?\d+,\d+$/

/**
 * Normalizes what a user typed into a canonical dot-decimal number string.
 * A single decimal comma is accepted ("0,02" becomes "0.02"); thousands
 * separators, exponents and spaces are rejected (returns null).
 */
export function normalizeNumberInput(raw: string): string | null {
  const text = raw.trim()
  if (PLAIN_NUMBER.test(text)) return text
  if (COMMA_NUMBER.test(text)) return text.replace(",", ".")
  return null
}

/** Splits a legacy comma separated string into distinct, trimmed tokens. */
export function splitMultiselectString(raw: string): string[] {
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const part of raw.split(",")) {
    const token = part.trim()
    const folded = token.toLowerCase()
    if (token === "" || seen.has(folded)) continue
    seen.add(folded)
    tokens.push(token)
  }
  return tokens
}

/** Empty form value for a field type. */
export function emptyFormValue(field: Pick<AssetFamilyField, "type">): AttributeFormValue {
  if (field.type === "boolean") return false
  if (field.type === "multiselect") return []
  return ""
}

/** True when a form value counts as "no value" (blank string or empty array). */
export function isBlankFormValue(value: AttributeFormValue | undefined | null): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** Form-side mirror of the API coercion: stored value (any legacy or typed shape) to a control value. */
export function toFormValue(
  field: Pick<AssetFamilyField, "type">,
  stored: AssetAttributeValue | undefined,
): AttributeFormValue {
  if (field.type === "multiselect") {
    if (Array.isArray(stored)) return stored
    if (typeof stored === "string") return splitMultiselectString(stored)
    if (stored == null || typeof stored === "boolean") return []
    return [String(stored)]
  }
  if (field.type === "boolean") {
    if (typeof stored === "boolean") return stored
    if (typeof stored === "string") {
      const text = stored.trim().toLowerCase()
      return text === "true" || text === "1"
    }
    return false
  }
  return attributeToInputString(stored)
}

function sameFormValue(a: AttributeFormValue | undefined | null, b: AttributeFormValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => item === b[index])
  return a === b
}

/**
 * The stored raw value when the user did not touch the field (the form value still equals
 * what loading the stored value produced); undefined when the field was changed or has no
 * stored value. Untouched values are re-sent and exempt from client validation, so a legacy
 * value such as "1,000" is never silently rewritten (spec 4.3 rule 3).
 */
export function untouchedStoredValue(
  field: Pick<AssetFamilyField, "type">,
  value: AttributeFormValue | undefined | null,
  stored: AssetAttributeValue | undefined,
): AssetAttributeValue | undefined {
  if (stored == null || isBlankFormValue(toFormValue(field, stored))) return undefined
  return sameFormValue(value, toFormValue(field, stored)) ? stored : undefined
}

/** Form value to API payload value. Blank becomes null so the API treats the key as absent. */
export function toPayloadValue(
  field: FieldShape,
  value: AttributeFormValue | undefined | null,
): AttributePayloadValue {
  if (value == null) return null
  if (field.type === "boolean") {
    if (typeof value === "boolean") return value
    const text = Array.isArray(value) ? "" : value.trim().toLowerCase()
    return text === "true" || text === "1"
  }
  if (field.type === "multiselect") {
    const items = Array.isArray(value) ? value : splitMultiselectString(String(value))
    return items.length === 0 ? null : items
  }
  const text = Array.isArray(value) ? value.join(", ") : String(value).trim()
  if (text === "") return null
  if (field.type === "number") {
    const normalized = normalizeNumberInput(text)
    return normalized === null ? text : Number(normalized)
  }
  return text
}

/** Read-only display string for a stored value (WEB-3 reuses this). */
export function formatAttributeValue(
  field: Pick<AssetFamilyField, "type" | "unit">,
  stored: AssetAttributeValue | undefined,
  locale: string,
): string {
  if (stored == null || stored === "" || (Array.isArray(stored) && stored.length === 0)) return ""
  if (field.type === "number") {
    const normalized = typeof stored === "number" ? String(stored) : normalizeNumberInput(String(stored))
    if (normalized !== null && Number.isFinite(Number(normalized))) {
      const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(Number(normalized))
      return field.unit ? `${formatted} ${field.unit}` : formatted
    }
  }
  if (typeof stored === "boolean") return stored ? "true" : "false"
  return attributeToInputString(stored)
}
