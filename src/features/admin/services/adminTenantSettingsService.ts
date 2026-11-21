import { z } from "zod"

import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

/** Keys the API lets a platform admin edit (allow-list, vlr-api `TenantSettingKeys.AdminEditableKeys`). */
export const BOOKING_UI_ENABLED_KEY = "rentals.booking_ui.enabled"

const tenantSettingSchema = z.object({
  key: z.string().nullish(),
  value: z.string().nullish(),
})

function settingPath(tenantId: string, key: string): string {
  return `/api/admin/tenants/${encodeURIComponent(tenantId)}/settings/${encodeURIComponent(key)}`
}

/** The API stores booleans as "true"/"false"; a missing value means false. */
export function parseBooleanSetting(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === "true"
}

export async function getAdminTenantBooleanSetting(
  tenantId: string,
  key: string,
): Promise<boolean> {
  try {
    const response = await api.get<unknown>(settingPath(tenantId, key))
    return parseBooleanSetting(tenantSettingSchema.parse(response.data).value)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("admin.edit.advanced.errors.loadFailed"),
      ),
    )
  }
}

export async function putAdminTenantBooleanSetting(
  tenantId: string,
  key: string,
  enabled: boolean,
): Promise<boolean> {
  try {
    const response = await api.put<unknown>(settingPath(tenantId, key), {
      value: enabled ? "true" : "false",
    })
    return parseBooleanSetting(tenantSettingSchema.parse(response.data).value)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("admin.edit.advanced.errors.saveFailed"),
      ),
    )
  }
}
