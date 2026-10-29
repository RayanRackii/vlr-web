import { describe, expect, it } from "vitest"
import { Bell, CalendarCheck, Package } from "lucide-react"

import {
  formatRelativeTime,
  groupLabelSlug,
  moduleIcon,
  resolveStaffRoute,
} from "@/features/notifications-inbox/lib/notificationPresentation"

describe("groupLabelSlug", () => {
  it.each([
    ["catalog.order.created", "orderCreated"],
    ["catalog.order.approved", "orderApproved"],
    ["catalog.order.ready", "orderReady"],
    ["catalog.order.rejected", "orderRejected"],
    ["catalog.order.cancelledBySupplier", "orderCancelledBySupplier"],
    ["catalog.order.cancelledByCustomer", "orderCancelledByCustomer"],
    ["rentals.reservation.confirmed", "reservationConfirmed"],
    ["rentals.reservation.pendingDeposit", "reservationPendingDeposit"],
    ["rentals.reservation.canceled", "reservationCanceled"],
    ["rentals.reservation.completed", "reservationCompleted"],
    ["rentals.reservation.reminder", "reservationReminder"],
  ])("maps %s to %s", (eventType, slug) => {
    expect(groupLabelSlug(eventType)).toBe(slug)
  })

  it("normalizes separator/casing variance to the same slug", () => {
    expect(groupLabelSlug("Catalog.Order.Created")).toBe("orderCreated")
    expect(groupLabelSlug("catalog_order_created")).toBe("orderCreated")
  })

  it("prefers the customer-cancel variant over the bare cancel rule", () => {
    expect(groupLabelSlug("catalog.order.cancelledByCustomer")).toBe(
      "orderCancelledByCustomer",
    )
  })

  it("returns null for unknown event types so the fallback is used", () => {
    expect(groupLabelSlug("payments.invoice.paid")).toBeNull()
  })
})

describe("moduleIcon", () => {
  it("maps known modules to their glyph and unknown ones to the bell", () => {
    expect(moduleIcon("catalog")).toBe(Package)
    expect(moduleIcon("rentals")).toBe(CalendarCheck)
    expect(moduleIcon("mystery")).toBe(Bell)
  })
})

describe("resolveStaffRoute", () => {
  it("rebases tenant-relative routes onto the staff path per module, keeping the query", () => {
    expect(resolveStaffRoute("catalog", "/pedidos?status=pending")).toBe(
      "/catalogo/pedidos?status=pending",
    )
    expect(resolveStaffRoute("rentals", "/reservas")).toBe(
      "/configuracoes/reservas",
    )
  })

  it("passes unknown modules through untouched", () => {
    expect(resolveStaffRoute("other", "/somewhere?x=1")).toBe("/somewhere?x=1")
  })
})

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-28T12:00:00.000Z")

  it("formats recent instants in English", () => {
    const threeMinAgo = new Date("2026-10-28T11:57:00.000Z").toISOString()
    expect(formatRelativeTime(threeMinAgo, "en", now)).toBe("3 minutes ago")
  })

  it("formats recent instants in pt-BR", () => {
    const twoHoursAgo = new Date("2026-10-28T10:00:00.000Z").toISOString()
    expect(formatRelativeTime(twoHoursAgo, "pt-BR", now)).toContain("2 h")
  })

  it("returns the raw value for an unparseable instant", () => {
    expect(formatRelativeTime("not-a-date", "en", now)).toBe("not-a-date")
  })
})
