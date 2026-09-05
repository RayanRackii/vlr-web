import {
  adminModuleCatalogListSchema,
  isNeverSelectableModuleKey,
  type AdminModuleCatalogItem,
} from "@/features/admin/schemas/adminModuleCatalogSchemas"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"
import { ZodError } from "zod"

function throwModulesError(error: unknown, fallback: string): never {
  if (error instanceof ZodError) {
    throw new Error(fallback)
  }

  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }

  throw new Error(parseApiError(getAxiosErrorPayload(error), fallback))
}

export async function listAdminModules(): Promise<AdminModuleCatalogItem[]> {
  try {
    const response = await api.get<unknown>("/api/admin/modules")
    const parsed = adminModuleCatalogListSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error: unknown) {
    throwModulesError(error, i18n.t("apiErrors.loadAdminModules"))
  }
}

export { isNeverSelectableModuleKey }

export function selectableCommercialModules(
  items: readonly AdminModuleCatalogItem[],
): AdminModuleCatalogItem[] {
  return items.filter((item) => {
    if (isNeverSelectableModuleKey(item.key)) {
      return false
    }
    return item.isCommercial && !item.isLegacy
  })
}
