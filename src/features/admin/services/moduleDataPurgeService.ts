import {
  moduleDataPurgePreviewSchema,
  moduleDataPurgeScheduledSchema,
  type ModuleDataPurgePreview,
  type ModuleDataPurgeScheduled,
} from "@/features/admin/schemas/moduleDataPurgeSchemas"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

/** Error carrying the API code (`confirm.mismatch`, `purge.already_pending`, ...) and, on 409, the blocking preview. */
export class ModuleDataPurgeError extends Error {
  readonly code: string | null
  readonly preview: ModuleDataPurgePreview | null

  constructor(message: string, code: string | null, preview: ModuleDataPurgePreview | null) {
    super(message)
    this.name = "ModuleDataPurgeError"
    this.code = code
    this.preview = preview
  }
}

const KNOWN_CODE_MESSAGES: Record<string, string> = {
  "module.unknown": "admin.modulePurge.errors.moduleUnknown",
  "module.not_purgeable": "admin.modulePurge.errors.notPurgeable",
  "purge.already_pending": "admin.modulePurge.errors.alreadyPending",
  "confirm.mismatch": "admin.modulePurge.errors.confirmMismatch",
  "reason.too_long": "admin.modulePurge.errors.reasonTooLong",
}

function extractCode(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null
  const code = (payload as Record<string, unknown>).code
  return typeof code === "string" ? code : null
}

function toPurgeError(error: unknown, fallbackKey: string): ModuleDataPurgeError {
  if (error instanceof ModuleDataPurgeError) return error
  const fallback = i18n.t(fallbackKey)
  if (!isAxiosError(error)) {
    return new ModuleDataPurgeError(
      error instanceof Error ? error.message : fallback,
      null,
      null,
    )
  }
  const payload = getAxiosErrorPayload(error)
  const code = extractCode(payload)
  const knownKey = code ? KNOWN_CODE_MESSAGES[code] : undefined
  if (knownKey) return new ModuleDataPurgeError(i18n.t(knownKey), code, null)

  if (error.response?.status === 409) {
    const parsed = moduleDataPurgePreviewSchema.safeParse(payload)
    if (parsed.success && parsed.data.blockers.length > 0) {
      return new ModuleDataPurgeError(
        i18n.t("admin.modulePurge.errors.blocked"),
        "blocked",
        parsed.data,
      )
    }
  }
  if (error.response?.status === 404) {
    return new ModuleDataPurgeError(i18n.t("admin.modulePurge.errors.notFound"), code, null)
  }
  return new ModuleDataPurgeError(parseApiError(payload, fallback), code, null)
}

function basePath(tenantId: string, moduleKey: string): string {
  return `/api/admin/tenants/${encodeURIComponent(tenantId)}/modules/${encodeURIComponent(moduleKey)}/data-purge`
}

export async function getModuleDataPurgePreview(
  tenantId: string,
  moduleKey: string,
): Promise<ModuleDataPurgePreview> {
  try {
    const response = await api.get<unknown>(`${basePath(tenantId, moduleKey)}/preview`)
    const parsed = moduleDataPurgePreviewSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new ModuleDataPurgeError(i18n.t("apiErrors.invalidPayload"), null, null)
    }
    return parsed.data
  } catch (error: unknown) {
    throw toPurgeError(error, "admin.modulePurge.errors.loadFailed")
  }
}

export async function scheduleModuleDataPurge(
  tenantId: string,
  moduleKey: string,
  confirm: string,
): Promise<ModuleDataPurgeScheduled> {
  try {
    const response = await api.post<unknown>(basePath(tenantId, moduleKey), { confirm })
    const parsed = moduleDataPurgeScheduledSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new ModuleDataPurgeError(i18n.t("apiErrors.invalidPayload"), null, null)
    }
    return parsed.data
  } catch (error: unknown) {
    throw toPurgeError(error, "admin.modulePurge.errors.scheduleFailed")
  }
}

export async function cancelModuleDataPurge(
  tenantId: string,
  moduleKey: string,
  reason?: string,
): Promise<void> {
  try {
    const trimmed = reason?.trim()
    await api.delete(basePath(tenantId, moduleKey), {
      params: trimmed ? { reason: trimmed } : undefined,
    })
  } catch (error: unknown) {
    throw toPurgeError(error, "admin.modulePurge.errors.cancelFailed")
  }
}
