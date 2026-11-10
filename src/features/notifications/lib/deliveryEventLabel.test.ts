import { describe, expect, it } from "vitest"

import { deliveryEventLabel } from "@/features/notifications/lib/deliveryEventLabel"
import i18n from "@/lib/i18n"

describe("deliveryEventLabel", () => {
  it("labels catalog and rentals events from the event key", () => {
    const translate = (key: string, options?: { defaultValue?: string }) =>
      i18n.t(key, { ...options, lng: "pt-BR" })
    expect(deliveryEventLabel("catalog.order.created", translate)).toBe("Pedido criado")
    expect(deliveryEventLabel("rentals.reservation.confirmed", translate)).toBe("Reserva confirmada")
  })

  it("returns an unknown event key unchanged", () => {
    expect(deliveryEventLabel("pmoc.plan.due", (key) => key)).toBe("pmoc.plan.due")
  })
})
