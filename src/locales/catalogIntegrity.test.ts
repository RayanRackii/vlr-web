import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import en from "@/locales/en/common.json"
import es from "@/locales/es/common.json"
import ptBR from "@/locales/pt-BR/common.json"
import { ptBRPermissionCopy } from "@/locales/pt-BR/permissionCopy"

function leafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") {
    expect(value.trim(), prefix).not.toBe("")
    return [prefix]
  }

  if (typeof value !== "object" || value === null) {
    throw new Error(`Invalid translation at ${prefix}`)
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
    leafKeys(entry, prefix ? `${prefix}.${key}` : key),
  )
}

describe("translation catalog integrity", () => {
  it.each([
    { locale: "en", catalog: en },
    { locale: "es", catalog: es },
  ])("keeps the same nonempty keys in $locale and pt-BR", ({ catalog }) => {
    expect(leafKeys(catalog).sort()).toEqual(leafKeys(ptBR).sort())
  })

  it.each(["pt-BR", "en", "es"])(
    "preserves the complete catalog and permission copy in %s at runtime",
    (locale) => {
      const resources: unknown = i18n.getResourceBundle(locale, "common")
      const expected = [...leafKeys(ptBR), ...leafKeys(ptBRPermissionCopy)]
      expect(leafKeys(resources).sort()).toEqual(expected.sort())
    },
  )
})
