import i18n from "@/lib/i18n"
import { customerApi } from "@/lib/api"
import { markReadResponseSchema, notificationListSchema, notificationSummarySchema } from "@/features/notifications-inbox/schemas/notificationInboxSchemas"

import type { ListNotificationsParams } from "@/features/notifications-inbox/services/notificationInboxService"

const PATH = "/api/me/customer-notifications"

export async function getNotificationSummary(signal?: AbortSignal) {
  const response = await customerApi.get(`${PATH}/summary`, { signal })
  const parsed = notificationSummarySchema.safeParse(response.data)
  if (!parsed.success) throw new Error(i18n.t("apiErrors.invalidResponse"))
  return parsed.data
}

export async function listNotifications(
  params: ListNotificationsParams = {},
  signal?: AbortSignal,
) {
  const response = await customerApi.get(PATH, { params, signal })
  const parsed = notificationListSchema.safeParse(response.data)
  if (!parsed.success) throw new Error(i18n.t("apiErrors.invalidResponse"))
  return parsed.data
}

export async function markIdsRead(ids: string[]) {
  const results = await Promise.all(ids.map(async (id) => {
    const response = await customerApi.post(`${PATH}/${encodeURIComponent(id)}/read`)
    const parsed = markReadResponseSchema.safeParse(response.data)
    if (!parsed.success) throw new Error(i18n.t("apiErrors.invalidResponse"))
    return parsed.data
  }))
  return { updated: results.reduce((total, result) => total + result.updated, 0) }
}

export async function markAllRead() {
  const response = await customerApi.post(`${PATH}/read-all`)
  const parsed = markReadResponseSchema.safeParse(response.data)
  if (!parsed.success) throw new Error(i18n.t("apiErrors.invalidResponse"))
  return parsed.data
}
