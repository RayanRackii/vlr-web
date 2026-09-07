import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import {
  tenantNotificationChannelGroupListSchema,
  updateTenantNotificationChannelResponseSchema,
  type TenantNotificationChannel,
  type TenantNotificationChannelGroup,
  type UpdateTenantNotificationChannelResponse,
} from "@/features/notifications/schemas/notificationChannelConfigSchemas"

function throwNotificationConfigError(
  error: unknown,
  fallbackKey: string,
): never {
  throw new Error(
    parseApiError(getAxiosErrorPayload(error), i18n.t(fallbackKey)),
  )
}

function parseOrThrow<T>(
  parsed: { success: true; data: T } | { success: false },
): T {
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

export async function listNotificationChannelConfigs(): Promise<
  TenantNotificationChannelGroup[]
> {
  try {
    const response = await api.get("/api/notifications/channel-configs")
    return parseOrThrow(
      tenantNotificationChannelGroupListSchema.safeParse(response.data),
    )
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === i18n.t("apiErrors.invalidPayload")
    ) {
      throw error
    }
    throwNotificationConfigError(
      error,
      "apiErrors.loadNotificationChannelConfigs",
    )
  }
}

export async function updateNotificationChannelConfig(body: {
  eventType: string
  channel: TenantNotificationChannel
  isActive: boolean
}): Promise<UpdateTenantNotificationChannelResponse> {
  try {
    const response = await api.put("/api/notifications/channel-configs", body)
    return parseOrThrow(
      updateTenantNotificationChannelResponseSchema.safeParse(response.data),
    )
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === i18n.t("apiErrors.invalidPayload")
    ) {
      throw error
    }
    throwNotificationConfigError(
      error,
      "apiErrors.saveNotificationChannelConfig",
    )
  }
}
