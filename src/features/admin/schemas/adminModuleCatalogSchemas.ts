import { toCanonicalModuleName } from "@/features/catalog/customerNav"
import { z } from "zod"

const NEVER_SELECTABLE_KEYS = new Set(["asset-registry", "maintenance"])

export function isNeverSelectableModuleKey(moduleKey: string): boolean {
  return NEVER_SELECTABLE_KEYS.has(toCanonicalModuleName(moduleKey))
}

export const adminModuleCatalogItemSchema = z.object({
  key: z.string().min(1),
  isCommercial: z.boolean(),
  isLegacy: z.boolean(),
  provides: z.array(z.string()),
  requiredCapabilities: z.array(z.string()),
  aliases: z.array(z.string()),
})

export const adminModuleCatalogListSchema = z.array(adminModuleCatalogItemSchema)

export type AdminModuleCatalogItem = z.infer<typeof adminModuleCatalogItemSchema>
