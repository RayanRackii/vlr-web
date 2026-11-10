import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import {
  NOTIFICATION_DELIVERY_MAX_PAGE_SIZE,
  NOTIFICATION_DELIVERY_PAGE_SIZE,
  notificationDeliveryPageSchema,
  notificationDeliverySchema,
  type NotificationDelivery,
  type NotificationDeliveryPage,
} from "@/features/notifications/schemas/notificationDeliverySchemas"
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
} from "@/features/catalog/schemas/catalogSchemas"

export type NotificationDeliveryQuery = {
  page?: number
  pageSize?: number
  status?: NotificationDeliveryStatus
  channel?: NotificationChannel
  event?: string
  from?: string
  to?: string
}

function clampPageSize(pageSize: number | undefined): number {
  const size = pageSize ?? NOTIFICATION_DELIVERY_PAGE_SIZE
  return Math.min(NOTIFICATION_DELIVERY_MAX_PAGE_SIZE, Math.max(1, size))
}

function parseOrThrow<T>(
  parsed: { success: true; data: T } | { success: false },
): T {
  if (!parsed.success) {
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }
  return parsed.data
}

function throwDeliveryError(error: unknown, fallbackKey: string): never {
  throw new Error(parseApiError(getAxiosErrorPayload(error), i18n.t(fallbackKey)))
}

export async function listNotificationDeliveries(
  query: NotificationDeliveryQuery = {},
): Promise<NotificationDeliveryPage> {
  const params = Object.fromEntries(
    Object.entries({
      page: Math.max(1, query.page ?? 1),
      pageSize: clampPageSize(query.pageSize),
      status: query.status,
      channel: query.channel,
      event: query.event?.trim() || undefined,
      from: query.from,
      to: query.to,
    }).filter((entry) => entry[1] !== undefined),
  )
  try {
    const response = await api.get("/api/notifications/deliveries", { params })
    return parseOrThrow(notificationDeliveryPageSchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwDeliveryError(error, "apiErrors.loadCatalogNotifications")
  }
}

export async function resendNotificationDelivery(
  deliveryId: string,
): Promise<NotificationDelivery> {
  try {
    const response = await api.post(`/api/notifications/deliveries/${deliveryId}/resend`)
    return parseOrThrow(notificationDeliverySchema.safeParse(response.data))
  } catch (error) {
    if (error instanceof Error && error.message === i18n.t("apiErrors.invalidPayload")) {
      throw error
    }
    throwDeliveryError(error, "apiErrors.resendCatalogNotification")
  }
}
