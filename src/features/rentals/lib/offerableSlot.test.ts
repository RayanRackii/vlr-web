import { describe, expect, it } from "vitest"

import {
  isPastTenantSlotStart,
  withoutPastTenantSlots,
} from "@/features/rentals/lib/offerableSlot"
import { DEFAULT_TENANT_TIME_ZONE } from "@/lib/tenantTimeZone"

const NOON_SAO_PAULO = new Date("2026-10-15T15:00:00.000Z")

describe("offerableSlot", () => {
  it("hides a slot that already started today on the tenant clock", () => {
    expect(
      isPastTenantSlotStart(
        "2026-10-15",
        "11:00:00",
        DEFAULT_TENANT_TIME_ZONE,
        NOON_SAO_PAULO,
      ),
    ).toBe(true)
    expect(
      isPastTenantSlotStart(
        "2026-10-15",
        "12:00:00",
        DEFAULT_TENANT_TIME_ZONE,
        NOON_SAO_PAULO,
      ),
    ).toBe(true)
    expect(
      isPastTenantSlotStart(
        "2026-10-15",
        "12:01:00",
        DEFAULT_TENANT_TIME_ZONE,
        NOON_SAO_PAULO,
      ),
    ).toBe(false)
  })

  it("keeps morning slots on a later civil date", () => {
    const slots = [
      { startTime: "08:00:00", resourceId: "a" },
      { startTime: "13:00:00", resourceId: "b" },
    ]

    expect(
      withoutPastTenantSlots(
        "2026-10-16",
        slots,
        DEFAULT_TENANT_TIME_ZONE,
        NOON_SAO_PAULO,
      ),
    ).toEqual(slots)
    expect(withoutPastTenantSlots(
      "2026-10-15",
      slots,
      DEFAULT_TENANT_TIME_ZONE,
      NOON_SAO_PAULO,
    )).toEqual([
      { startTime: "13:00:00", resourceId: "b" },
    ])
  })
})
