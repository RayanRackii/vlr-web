import { afterEach, describe, expect, it } from "vitest"

import {
  portalProductRequestRange,
  productRequestStatusLabel,
} from "@/features/catalog/lib/productRequestStatusLabel"
import { productRequestStatusSchema } from "@/features/catalog/schemas/catalogSchemas"
import i18n, { supportedLanguages } from "@/lib/i18n"

describe("productRequestStatusLabel", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("translates every known status in pt-BR, en, and es and keeps unknown statuses", async () => {
    for (const language of supportedLanguages) {
      await i18n.changeLanguage(language)
      for (const status of productRequestStatusSchema.options) {
        const expected: unknown = i18n.getResource(
          language,
          "common",
          `catalog.productRequestStatus.${status}`,
        )
        expect(typeof expected).toBe("string")
        expect(expected).not.toBe(`catalog.productRequestStatus.${status}`)
        expect(
          productRequestStatusLabel(status, (key, options) =>
            i18n.t(key, options),
          ),
        ).toBe(expected)
      }

      expect(
        productRequestStatusLabel("Quoted", (key, options) =>
          i18n.t(key, options),
        ),
      ).toBe("Quoted")
    }
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
