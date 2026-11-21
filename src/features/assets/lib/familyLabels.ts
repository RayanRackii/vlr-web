import type { TFunction } from "i18next"

type LabelSource = { label?: string | null; labelKey?: string | null }

/** Family label: seeded families resolve `labelKey` in the user's language; others keep the stored label. */
export function familyLabel(t: TFunction, family: LabelSource & { label: string }): string {
  return family.labelKey ? t(family.labelKey, { defaultValue: family.label }) : family.label
}

/** Field label: `labelKey` first, then `fallback` (already localized by the caller), then the stored label or key. */
export function familyFieldLabel(
  t: TFunction,
  field: LabelSource & { key: string },
  fallback?: string,
): string {
  const base = fallback ?? field.label ?? field.key
  return field.labelKey ? t(field.labelKey, { defaultValue: base }) : base
}
