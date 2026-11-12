import { describe, expect, it } from "vitest"

import { toResourceTypeView } from "@/features/assets/resourceTypes/resourceTypeModel"

describe("resource type view", () => {
  it("marks Quadra and Caçamba as seeded and keeps other names as company types", () => {
    const quadra = toResourceTypeView({
      id: "11111111-1111-4111-8111-111111111111",
      key: "quadra",
      name: "Quadra",
      fields: [],
      capabilities: { bookable: true, maintenance: true },
    })
    const dumpster = toResourceTypeView({
      id: "22222222-2222-4222-8222-222222222222",
      key: "cacamba",
      name: "Caçamba",
      singular: "caçamba",
      plural: "caçambas",
      article: "uma",
      fields: [],
      deliverable: true,
    })
    const custom = toResourceTypeView({
      id: "33333333-3333-4333-8333-333333333333",
      key: "profissional",
      name: "Profissional",
      singular: "profissional",
      fields: [
        { key: "especialidade", type: "list", required: true, label: "Especialidade", visibility: "public", filterable: true, options: ["Corte"] },
        { key: "comissao", type: "number", required: false, visibility: "internal" },
      ],
    })

    expect(quadra.seeded).toBe(true)
    expect(quadra.capabilities).toEqual({ bookable: true, deliverable: false, maintenance: true })
    expect(dumpster.seeded).toBe(true)
    expect(dumpster.article).toBe("uma")
    expect(dumpster.capabilities.deliverable).toBe(true)
    expect(custom.seeded).toBe(false)
    expect(custom.publicFieldCount).toBe(1)
    expect(custom.internalFieldCount).toBe(1)
    expect(custom.fields[1]?.filterable).toBe(false)
  })
})
