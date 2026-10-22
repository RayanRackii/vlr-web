import { describe, expect, it } from "vitest"

import { mergeTemplateOptions } from "@/features/rentals/components/RentalResourceSheet"

describe("mergeTemplateOptions", () => {
  it("retains a newly created template when the active filters exclude it", () => {
    expect(mergeTemplateOptions([], [{ value: "published-1", label: "Modelo novo" }], "Sem modelo")).toEqual([
      { value: "__no-template__", label: "Sem modelo" },
      { value: "published-1", label: "Modelo novo" },
    ])
  })
})
