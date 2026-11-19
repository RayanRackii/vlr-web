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
