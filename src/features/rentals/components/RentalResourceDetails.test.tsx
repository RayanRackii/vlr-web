import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RentalResourceDetails } from "@/features/rentals/components/RentalResourceDetails"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import i18n from "@/lib/i18n"

const asset: AdminRentalAsset = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  assetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Sala 1",
  isActive: true,
  requiresDeposit: false,
  schedulePolicy: "SlotGrid",
  openTime: null,
  closeTime: null,
  allowedDurationMinutes: null,
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  type: "Location",
  totalQuantity: 1,
  queueEnabled: false,
}

describe("RentalResourceDetails", () => {
  it.each([
    ["Hour", "por hora"],
    ["Slot", "por horário"],
    ["Day", "por dia"],
    ["Fixed", "fixo"],
  ] as const)("shows the %s pricing unit", (pricingUnit, suffix) => {
    render(<RentalResourceDetails asset={asset} pricePerHour={45} pricingUnit={pricingUnit} />)
    expect(screen.getByText(new RegExp(`R\\$ 45,00 ${suffix}`))).toBeInTheDocument()
  })

  it.each([null, 0, undefined])("shows the neutral capacity label when capacity is %s", (capacityPeople) => {
    render(<RentalResourceDetails asset={{ ...asset, capacityPeople }} pricePerHour={null} />)

    expect(screen.getByText(i18n.t("rentals.resources.details.capacityUnknown"))).toBeInTheDocument()
  })
})
