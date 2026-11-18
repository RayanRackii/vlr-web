import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import { parsePriceUnit, priceUnitSuffix, withPriceUnit } from "@/features/catalog/lib/catalogPriceUnit"
import { catalogProductSchema, portalProductSchema } from "@/features/catalog/schemas/catalogSchemas"

const t = i18n.t.bind(i18n)

describe("catalogPriceUnit", () => {
  it("formats the suffix for each known unit and nothing for null", () => {
    expect(priceUnitSuffix(t, "Unit")).toBe("por unidade")
    expect(priceUnitSuffix(t, "Hour")).toBe("por hora")
    expect(priceUnitSuffix(t, "Day")).toBe("por dia")
    expect(priceUnitSuffix(t, "Person")).toBe("por pessoa")
    expect(priceUnitSuffix(t, "Booking")).toBe("por reserva")
    expect(priceUnitSuffix(t, "Package")).toBe("por pacote")
    expect(priceUnitSuffix(t, null)).toBeNull()
    expect(priceUnitSuffix(t, "Bogus")).toBeNull()
  })

  it("appends the unit to a price", () => {
    expect(withPriceUnit(t, "R$ 45,00", "Unit")).toBe("R$ 45,00 por unidade")
    expect(withPriceUnit(t, "R$ 45,00", null)).toBe("R$ 45,00")
  })

  it("parses unknown values to null", () => {
    expect(parsePriceUnit("Hour")).toBe("Hour")
    expect(parsePriceUnit("")).toBeNull()
    expect(parsePriceUnit(undefined)).toBeNull()
  })

  it("keeps priceUnit optional in product schemas and tolerates unknown values", () => {
    const base = { id: "11111111-1111-4111-8111-111111111111", name: "A", code: null, description: null, price: 1, currency: "BRL", isActive: true, createdAt: "x", files: [] }
    expect(catalogProductSchema.parse(base).priceUnit).toBeUndefined()
    expect(catalogProductSchema.parse({ ...base, priceUnit: "Day" }).priceUnit).toBe("Day")
    expect(catalogProductSchema.parse({ ...base, priceUnit: "Weird" }).priceUnit).toBeNull()
    expect(portalProductSchema.parse({ ...base, priceUnit: "Person" }).priceUnit).toBe("Person")
  })
})
