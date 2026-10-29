import { api } from "@/lib/api"
import {
  markReadResponseSchema,
  notificationListSchema,
  notificationSummarySchema,
  type MarkReadResponse,
  type NotificationList,
  type NotificationSummary,
} from "@/features/notifications-inbox/schemas/notificationInboxSchemas"

const SUMMARY_PATH = "/api/me/notifications/summary"
const LIST_PATH = "/api/me/notifications"
const READ_PATH = "/api/me/notifications/read"

/**
 * Unread counters grouped by event type. Callers (the bell poller) swallow
 * failures and keep the last good value, so this only throws on bad payloads /
 * transport errors — it never shows a toast.
 */
export async function getNotificationSummary(
  signal?: AbortSignal,
): Promise<NotificationSummary> {
  const response = await api.get(SUMMARY_PATH, { signal })
  return notificationSummarySchema.parse(response.data)
}

export type ListNotificationsParams = {
  cursor?: string
  unreadOnly?: boolean
  limit?: number
}

/** Recent deliveries for the optional "recentes" list under the grouped rows. */
export async function listNotifications(
  params: ListNotificationsParams = {},
  signal?: AbortSignal,
): Promise<NotificationList> {
  const response = await api.get(LIST_PATH, {
    params: {
      cursor: params.cursor,
      unreadOnly: params.unreadOnly,
      limit: params.limit,
    },
    signal,
  })
  return notificationListSchema.parse(response.data)
}

/** Mark one event-type group as read and return how many deliveries changed. */
export async function markEventTypeRead(
  eventType: string,
): Promise<MarkReadResponse> {
  const response = await api.post(READ_PATH, { eventType })
  return markReadResponseSchema.parse(response.data)
}

/** Mark specific deliveries read (used by the recent list rows). */
export async function markIdsRead(ids: string[]): Promise<MarkReadResponse> {
  const response = await api.post(READ_PATH, { ids })
  return markReadResponseSchema.parse(response.data)
}

/** Mark every unread delivery for the caller read ("Marcar tudo como lido"). */
export async function markAllRead(): Promise<MarkReadResponse> {
  const response = await api.post(READ_PATH, { all: true })
  return markReadResponseSchema.parse(response.data)
}
