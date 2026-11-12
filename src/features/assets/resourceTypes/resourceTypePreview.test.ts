import { describe, expect, it } from "vitest"

import { buildResourceTypePreview } from "@/features/assets/resourceTypes/resourceTypePreview"
import { toResourceTypeView } from "@/features/assets/resourceTypes/resourceTypeModel"

describe("resource type preview", () => {
  it("keeps internal fields out of the customer view and shows maintenance on one person", () => {
    const view = toResourceTypeView({
      id: "11111111-1111-4111-8111-111111111111",
      key: "profissional",
      name: "Profissional",
      capabilities: { bookable: true, deliverable: true, maintenance: true },
      fields: [
        { key: "especialidade", type: "list", required: true, name: "Especialidade", visibility: "public", filterable: true, askOnBooking: true, options: ["Corte", "Cor"] },
        { key: "comissao", type: "number", required: false, name: "Comissão interna", visibility: "internal", filterable: true, askOnBooking: true },
      ],
    })
    const preview = buildResourceTypePreview(view)
    expect(preview.filters.map((filter) => filter.name)).toEqual(["Especialidade"])
    expect(preview.questions.map((question) => question.name)).toEqual(["Especialidade"])
    expect(preview.hiddenCount).toBe(1)
    expect(preview.people[2]?.unavailable).toBe(true)
    expect(preview.people[0]?.tag).toBe("Corte")
    expect(preview.showHours).toBe(true)
    expect(preview.showDelivery).toBe(true)
    expect(JSON.stringify(preview)).not.toContain("Comissão")
  })
})
