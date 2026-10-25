import { afterEach, describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import { formatUnitPriceText } from "@/lib/pricingUnitText"

describe("formatUnitPriceText", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("formats each pricing unit for pt-BR", () => {
    expect(formatUnitPriceText(10, "Hour", "BRL", "pt-BR", i18n.t, "bookingMap.prices")).toBe("R$ 10,00/hora")
    expect(formatUnitPriceText(10, "Slot", "BRL", "pt-BR", i18n.t, "bookingMap.prices")).toBe("R$ 10,00/horário")
    expect(formatUnitPriceText(10, "Day", "BRL", "pt-BR", i18n.t, "bookingMap.prices")).toBe("R$ 10,00/dia")
    expect(formatUnitPriceText(10, "Fixed", "BRL", "pt-BR", i18n.t, "bookingMap.prices")).toBe("R$ 10,00 fixo")
  })

  it("formats each pricing unit for en and es", () => {
    expect(formatUnitPriceText(10, "Hour", "BRL", "en", i18n.t, "bookingMap.prices")).toBe("R$ 10.00/hour")
    expect(formatUnitPriceText(10, "Fixed", "BRL", "en", i18n.t, "bookingMap.prices")).toBe("R$ 10.00 fixed")
    expect(formatUnitPriceText(10, "Hour", "BRL", "es", i18n.t, "bookingMap.prices")).toBe("R$ 10,00/hora")
    expect(formatUnitPriceText(10, "Fixed", "BRL", "es", i18n.t, "bookingMap.prices")).toBe("R$ 10,00 fijo")
  })

  it("shares its formatting rule across different locale namespaces", () => {
    expect(
      formatUnitPriceText(25, "Day", "BRL", "pt-BR", i18n.t, "assets.wizard.review.unitPrice"),
    ).toBe("R$ 25,00/dia")
  })
})
