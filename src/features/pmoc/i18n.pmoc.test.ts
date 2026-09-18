import { describe, expect, it } from "vitest"

import en from "@/locales/en/common.json"
import es from "@/locales/es/common.json"
import ptBR from "@/locales/pt-BR/common.json"

function collectStrings(value: unknown, bucket: string[] = []): string[] {
  if (typeof value === "string") {
    bucket.push(value)
    return bucket
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, bucket)
    }
    return bucket
  }

  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      collectStrings(child, bucket)
    }
  }

  return bucket
}

describe("pmoc i18n copy", () => {
  it("has no CREA, Cardápio, or 100% conforme claims in pmoc template strings", () => {
    for (const locale of [ptBR, en, es]) {
      const templateStrings = collectStrings(locale.pmoc.templates).join("\n")
      const pmocStrings = collectStrings(locale.pmoc).join("\n")

      expect(templateStrings).not.toMatch(/\bCREA\b/i)
      expect(templateStrings).not.toMatch(/Cardápio/i)
      expect(templateStrings).not.toMatch(/100%\s*conforme/i)
      expect(pmocStrings).not.toMatch(/\bCREA\b/i)
      expect(pmocStrings).not.toMatch(/Cardápio/i)
      expect(pmocStrings).not.toMatch(/100%\s*conforme/i)
    }
  })

  it("uses Biblioteca Rolvix, Modelos padrão, and the auto-generate label", () => {
    expect(ptBR.nav.pmocLibrary).toBe("Biblioteca Rolvix")
    expect(ptBR.nav.pmocNew).toBe("Novo personalizado")
    expect(ptBR.pmoc.library.description).toMatch(/Modelos padrão/i)
    expect(ptBR.pmoc.templates.sourceReferences).toMatch(/Fontes e referências/i)
    expect(ptBR.pmoc.plans.autoGenerateEnabled).toBe(
      "Gerar ordens de serviço automaticamente",
    )
  })
})
