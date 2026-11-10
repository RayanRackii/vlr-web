import { describe, expect, it } from "vitest"
import { productItemStatus, resourceItemStatus, type ResourceStatusInput } from "./itemStatus"

const readyResource: ResourceStatusInput = {
  name: "Estúdio A",
  isActive: true,
  type: "Location",
  schedulePolicy: "OpenHours",
  openTime: "08:00:00",
  closeTime: "20:00:00",
  queueEnabled: false,
  allowedDurationMinutes: "60,120",
  cancelCutoffHours: 24,
  menuPublished: true,
  hasActiveTemplate: false,
  hasPrice: true,
}

describe("resource item status", () => {
  it("is published only when every step is done and the menu is on", () => {
    expect(resourceItemStatus(readyResource)).toEqual({ kind: "published" })
  })

  it("is a draft when the steps are done and customers cannot see it yet", () => {
    expect(resourceItemStatus({ ...readyResource, menuPublished: false })).toEqual({ kind: "draft" })
    expect(resourceItemStatus({ ...readyResource, isActive: false })).toEqual({ kind: "draft" })
  })

  it("counts the open steps", () => {
    expect(resourceItemStatus({
      ...readyResource,
      openTime: null,
      closeTime: null,
      allowedDurationMinutes: null,
      cancelCutoffHours: null,
      hasPrice: false,
      menuPublished: true,
    })).toEqual({ kind: "missing", count: 3 })
  })

  it("treats a switched-off queue as done and an open queue without a time as missing", () => {
    expect(resourceItemStatus({ ...readyResource, queueEnabled: false, queueOpeningTime: null }).kind).toBe("published")
    expect(resourceItemStatus({ ...readyResource, queueEnabled: true, queueOpeningTime: null })).toEqual({ kind: "missing", count: 1 })
    expect(resourceItemStatus({ ...readyResource, queueEnabled: true, queueOpeningTime: "08:00:00" }).kind).toBe("published")
  })

  it("uses the weekly template for a slot grid", () => {
    expect(resourceItemStatus({
      ...readyResource,
      schedulePolicy: "SlotGrid",
      openTime: null,
      closeTime: null,
      hasActiveTemplate: false,
    })).toEqual({ kind: "missing", count: 1 })
    expect(resourceItemStatus({
      ...readyResource,
      schedulePolicy: "SlotGrid",
      hasActiveTemplate: true,
    }).kind).toBe("published")
  })
})

describe("product item status", () => {
  const ready = {
    name: "Diária",
    isActive: true,
    price: 80,
    audienceReady: true,
    agendaReady: true,
    menuPublished: true,
  }

  it("follows the same three outcomes", () => {
    expect(productItemStatus(ready)).toEqual({ kind: "published" })
    expect(productItemStatus({ ...ready, menuPublished: false })).toEqual({ kind: "draft" })
    expect(productItemStatus({ ...ready, price: null, agendaReady: false })).toEqual({ kind: "missing", count: 3 })
  })
})
