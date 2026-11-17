import { describe, expect, it } from "vitest"

import { describeProductHistoryEntry, formatProductHistoryDate } from "@/features/catalog/lib/productHistoryText"
import type { CatalogProductHistoryEntry } from "@/features/catalog/schemas/catalogSchemas"
import i18n from "@/lib/i18n"

function entry(action: string, changes: { field: string; old: string | null; new: string | null }[]): CatalogProductHistoryEntry {
  return { id: "00000000-0000-4000-8000-000000000001", action, changes, actorName: null, createdAt: "2026-11-12T17:30:00.000Z" }
}

function describeIn(lng: string, value: CatalogProductHistoryEntry) {
  return describeProductHistoryEntry(value, { t: i18n.getFixedT(lng), locale: lng, currency: "BRL" })
}

describe("describeProductHistoryEntry", () => {
  it.each([
    ["pt-BR", "Preço alterado de R$ 40,00 para R$ 45,00"],
    ["en", "Price changed from R$ 40.00 to R$ 45.00"],
    ["es", "Precio cambiado de R$ 40,00 a R$ 45,00"],
  ])("describes a price change in %s", (lng, expected) => {
    expect(describeIn(lng, entry("product.updated", [{ field: "price", old: "40.00", new: "45.00" }]))).toBe(expected)
  })

  it("joins several field changes and agrees the verb with the field", () => {
    expect(describeIn("pt-BR", entry("product.updated", [
      { field: "name", old: "A", new: "B" },
      { field: "usesSchedule", old: "false", new: "true" },
      { field: "code", old: null, new: "X1" },
      { field: "price", old: "10.00", new: null },
    ]))).toBe("Nome alterado de A para B; Uso da agenda alterado de Não para Sim; Código definido como X1; Preço removido (era R$ 10,00)")
  })

  it("never prints description text or raw field codes", () => {
    expect(describeIn("pt-BR", entry("product.updated", [{ field: "description", old: "segredo", new: "novo" }]))).toBe("Descrição alterada")
    expect(describeIn("pt-BR", entry("product.updated", [{ field: "somethingNew", old: "a", new: "b" }]))).toBe("Cadastro alterado")
    expect(describeIn("pt-BR", entry("product.somethingNew", []))).toBe("Produto alterado")
  })

  it("describes lifecycle, taxonomy, access, file and copy entries", () => {
    expect(describeIn("pt-BR", entry("product.created", []))).toBe("Produto criado")
    expect(describeIn("pt-BR", entry("product.deactivated", [{ field: "isActive", old: "true", new: "false" }]))).toBe("Produto desativado")
    expect(describeIn("pt-BR", entry("product.deleted", [{ field: "name", old: "A", new: null }]))).toBe("Produto excluído")
    expect(describeIn("pt-BR", entry("product.taxonomyChanged", [{ field: "tags", old: "a", new: "a, b" }]))).toBe("Tags alteradas de a para a, b")
    expect(describeIn("pt-BR", entry("product.taxonomyChanged", [{ field: "categories", old: null, new: "Peças" }]))).toBe("Categorias definidas como Peças")
    expect(describeIn("pt-BR", entry("product.requirementsChanged", [{ field: "resourceRequirements", old: "x", new: "y" }]))).toBe("Recursos da agenda alterados")
    expect(describeIn("pt-BR", entry("product.accessChanged", [{ field: "visibility", old: "Public", new: "Restricted" }]))).toBe("Visibilidade alterada de Público para Restrito")
    expect(describeIn("pt-BR", entry("product.accessChanged", [{ field: "accessGroups", old: "0", new: "2" }]))).toBe("Grupos liberados alterados de 0 para 2")
    expect(describeIn("pt-BR", entry("product.fileAdded", [{ field: "file", old: null, new: "manual.pdf" }]))).toBe("Arquivo adicionado: manual.pdf")
    expect(describeIn("pt-BR", entry("product.fileRemoved", [{ field: "file", old: "manual.pdf", new: null }]))).toBe("Arquivo removido: manual.pdf")
    expect(describeIn("pt-BR", entry("product.duplicated", [{ field: "copy", old: null, new: "id" }]))).toBe("Cópia criada")
    expect(describeIn("pt-BR", entry("product.duplicated", [{ field: "source", old: "Original", new: null }]))).toBe("Criado como cópia de Original")
  })
})

describe("formatProductHistoryDate", () => {
  const now = new Date("2026-11-17T12:00:00Z")
  it("shows day/month and time on the tenant clock, adding the year only for another year", () => {
    expect(formatProductHistoryDate("2026-11-12T17:30:00Z", "pt-BR", "America/Sao_Paulo", now)).toMatch(/^12\/11[ ,]+14:30$/)
    expect(formatProductHistoryDate("2025-11-12T17:30:00Z", "pt-BR", "America/Sao_Paulo", now)).toMatch(/^12\/11\/25[ ,]+14:30$/)
  })
})
