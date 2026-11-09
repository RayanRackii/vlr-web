import { expect, it } from "vitest"
import i18n from "@/lib/i18n"
import { catalogAuditEntrySchema } from "@/features/catalog/schemas/catalogSchemas"
import { describeAccessChange } from "./describeAccessChange"

it("names the current restricted groups even when unchanged and avoids duplicate additions and retains removals in all locales", () => {
  const entry = catalogAuditEntrySchema.parse({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    entityType: "Product", action: "product.accessChanged", actorType: "B2BUser",
    createdAt: "2026-11-05T00:00:00Z",
    beforeJson: JSON.stringify({ visibility: "Restricted", groupIds: ["a", "b"] }),
    afterJson: JSON.stringify({ visibility: "Restricted", groupIds: ["a", "b"], customerIds: [] }),
  })
  for (const [locale, groups, empty] of [["pt-BR", "Grupos: A, B", "Grupos: nenhum"], ["en", "Groups: A, B", "Groups: none"], ["es", "Grupos: A, B", "Grupos: ninguno"]]) {
    const t = i18n.getFixedT(locale)
    expect(describeAccessChange(entry, { a: "A", b: "B" }, t)).toContain(groups)
    expect(describeAccessChange({ ...entry, afterJson: JSON.stringify({ visibility: "Restricted", groupIds: ["b", "c"] }) }, { a: "A", b: "B", c: "C" }, t)).toMatch(/B, C · − A/)
    expect(describeAccessChange({ ...entry, afterJson: JSON.stringify({ visibility: "Restricted", groupIds: ["b", "c"] }) }, { a: "A", b: "B", c: "C" }, t)).not.toContain("+ C")
    expect(describeAccessChange({ ...entry, afterJson: JSON.stringify({ visibility: "Restricted", groupIds: [] }) }, {}, t)).toContain(empty)
  }
})
