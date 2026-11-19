import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import { API_UPLOAD_TIMEOUT_MS } from "@/lib/apiTimeouts"
import i18n from "@/lib/i18n"
import {
  portalAppearanceSchema,
  type PortalAppearance,
  type PortalAppearanceWriteBody,
} from "@/features/company/schemas/portalAppearanceSchemas"

function parseAppearance(data: unknown): PortalAppearance {
  const parsed = portalAppearanceSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidResponse"))
  }
  return parsed.data
}

function fail(error: unknown, fallbackKey: string): never {
  throw new Error(parseApiError(getAxiosErrorPayload(error), i18n.t(fallbackKey)), { cause: error })
}

/** Any staff member may read it. */
export async function getPortalAppearance(): Promise<PortalAppearance> {
  try {
    return parseAppearance((await api.get("/api/portal-appearance")).data)
  } catch (error) {
    return fail(error, "portalAppearance.loadError")
  }
}

/** Needs core.company.write. Full replace of the three texts. */
export async function updatePortalAppearance(body: PortalAppearanceWriteBody): Promise<PortalAppearance> {
  try {
    return parseAppearance((await api.put("/api/portal-appearance", body)).data)
  } catch (error) {
    return fail(error, "portalAppearance.saveError")
  }
}

/** Needs core.company.write. jpg/png/webp up to 3 MB; `onProgress` receives 0-100. */
export async function uploadPortalLandingImage(file: File, onProgress?: (percent: number) => void): Promise<PortalAppearance> {
  const formData = new FormData()
  formData.append("file", file)
  try {
    const response = await api.post("/api/portal-appearance/landing-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: API_UPLOAD_TIMEOUT_MS,
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      },
    })
    return parseAppearance(response.data)
  } catch (error) {
    return fail(error, "portalAppearance.image.uploadError")
  }
}

/** Needs core.company.write. */
export async function deletePortalLandingImage(): Promise<PortalAppearance> {
  try {
    return parseAppearance((await api.delete("/api/portal-appearance/landing-image")).data)
  } catch (error) {
    return fail(error, "portalAppearance.image.removeError")
  }
}
