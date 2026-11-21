import { describe, expect, it } from "vitest"

import en from "@/locales/en/common.json"
import es from "@/locales/es/common.json"
import ptBR from "@/locales/pt-BR/common.json"

function strings(value: unknown, path = ""): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]]
  if (typeof value !== "object" || value === null) return []
  return Object.entries(value).flatMap(([key, entry]) => strings(entry, path ? `${path}.${key}` : key))
}

describe.each([
  ["pt-BR", ptBR],
  ["en", en],
  ["es", es],
])("user-facing wording in %s", (_lng, bundle) => {
  it("does not expose B2C jargon", () => {
    expect(strings(bundle).filter(([, text]) => /B2C/i.test(text))).toEqual([])
  })

  it("has a friendly label for the resource types purge table", () => {
    const label = (bundle as { admin: { modulePurge: { tables: Record<string, string> } } }).admin.modulePurge.tables.rentals_resource_types
    expect(label?.trim()).toBeTruthy()
  })
})
