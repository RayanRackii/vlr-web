import { catalogProductFormSchema } from "@/features/catalog/schemas/catalogSchemas"

export const CATALOG_PRODUCT_FIELD_ISSUE_KEYS: Record<string, string> = {
  name: "catalog.products.validation.nameRequired",
  code: "catalog.products.validation.code",
  description: "catalog.products.validation.description",
  currency: "catalog.products.validation.currency",
}

export function catalogProductSaveBlockerKeys(values: unknown): string[] {
  const parsed = catalogProductFormSchema.safeParse(values)
  if (parsed.success) {
    return []
  }

  const keys: string[] = []
  const seen = new Set<string>()
  for (const issue of parsed.error.issues) {
    const field = issue.path[0]
    const key = typeof field === "string" ? CATALOG_PRODUCT_FIELD_ISSUE_KEYS[field] : undefined
    if (key != null && !seen.has(key)) {
      seen.add(key)
      keys.push(key)
    }
  }

  return keys
}
