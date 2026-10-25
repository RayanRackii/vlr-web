import type { TFunction } from "i18next"

const BUILT_IN_KINDS = ["open", "closed", "lesson"] as const

/** One translated label per occupancy kind: built-in keys use i18n, custom kinds keep their tenant label. */
export function occupancyKindDisplayLabel(
  t: TFunction,
  kind: { key?: string | null; label?: string | null },
): string {
  const key = kind.key?.trim().toLowerCase() ?? ""
  if ((BUILT_IN_KINDS as readonly string[]).includes(key)) {
    return t(`rentals.schedule.occupancyKinds.${key}`)
  }
  return kind.label?.trim() || kind.key || ""
}
