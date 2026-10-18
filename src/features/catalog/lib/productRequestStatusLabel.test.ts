import { afterEach, describe, expect, it } from "vitest"

import {
  portalProductRequestRange,
  productRequestStatusLabel,
} from "@/features/catalog/lib/productRequestStatusLabel"
import i18n from "@/lib/i18n"

describe("productRequestStatusLabel", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("translates Submitted in pt-BR, en, and es and keeps unknown statuses", async () => {
    await i18n.changeLanguage("pt-BR")
    expect(productRequestStatusLabel("Submitted", (key) => i18n.t(key))).toBe(
      "Enviada",
    )

    await i18n.changeLanguage("en")
    expect(productRequestStatusLabel("Submitted", (key) => i18n.t(key))).toBe(
      "Submitted",
    )

    await i18n.changeLanguage("es")
    expect(productRequestStatusLabel("Submitted", (key) => i18n.t(key))).toBe(
      "Enviada",
    )

    expect(productRequestStatusLabel("Quoted", (key) => key)).toBe("Quoted")
  })
})

describe("portalProductRequestRange", () => {
  it("describes an empty list and a page past the first", () => {
    expect(portalProductRequestRange(1, 20, 0)).toEqual({
      from: 0,
      to: 0,
      pageCount: 1,
    })
    expect(portalProductRequestRange(1, 20, 21)).toEqual({
      from: 1,
      to: 20,
      pageCount: 2,
    })
    expect(portalProductRequestRange(2, 20, 21)).toEqual({
      from: 21,
      to: 21,
      pageCount: 2,
    })
  })
})
