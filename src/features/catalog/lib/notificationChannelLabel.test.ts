import { describe, expect, it } from "vitest"

import { notificationChannelLabel } from "@/features/catalog/lib/notificationChannelLabel"
import {
  catalogNotificationDeliverySchema,
  notificationChannelSchema,
} from "@/features/catalog/schemas/catalogSchemas"
import i18n from "@/lib/i18n"

const delivery = {
  id: "11111111-1111-4111-8111-111111111111",
  notificationId: "22222222-2222-4222-8222-222222222222",
  eventType: "OrderApproved",
  channel: "Push",
  recipientKind: "Customer",
  recipientId: null,
  recipientName: null,
  status: "Queued",
  attemptCount: 0,
  errorMessage: null,
  createdAt: "2026-11-21T10:00:00Z",
}

describe("notification channel tolerant reader", () => {
  it("accepts Push and channels added later", () => {
    expect(notificationChannelSchema.parse("Push")).toBe("Push")
    expect(catalogNotificationDeliverySchema.safeParse(delivery).success).toBe(true)
    expect(
      catalogNotificationDeliverySchema.safeParse({ ...delivery, channel: "Telegram" }).success,
    ).toBe(true)
  })

  it("labels known channels and falls back to a neutral label", () => {
    expect(notificationChannelLabel(i18n.t, "Push")).toBe(i18n.t("catalog.channels.Push"))
    expect(notificationChannelLabel(i18n.t, "Telegram")).toBe(i18n.t("catalog.channels.unknown"))
    expect(notificationChannelLabel(i18n.t, "Telegram")).not.toContain("Telegram")
  })
})
