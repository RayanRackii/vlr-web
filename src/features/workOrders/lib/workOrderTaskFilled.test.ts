import { describe, expect, it } from "vitest"

import { isWorkOrderTaskFilled } from "@/features/workOrders/lib/workOrderTaskFilled"

describe("isWorkOrderTaskFilled", () => {
  it("accepts only the exact checkbox value true", () => {
    expect(isWorkOrderTaskFilled({ inputType: "Checkbox" }, "true")).toBe(true)
    expect(isWorkOrderTaskFilled({ inputType: "Checkbox" }, "false")).toBe(false)
    expect(isWorkOrderTaskFilled({ inputType: "Checkbox" }, "TRUE")).toBe(false)
    expect(isWorkOrderTaskFilled({ inputType: "Checkbox" }, " true ")).toBe(false)
    expect(isWorkOrderTaskFilled({ inputType: "Checkbox" }, null)).toBe(false)
    expect(isWorkOrderTaskFilled({ inputType: "Checkbox" }, "")).toBe(false)
  })

  it("treats blank text as empty and keeps numeric zero", () => {
    expect(isWorkOrderTaskFilled({ inputType: "Text" }, "   ")).toBe(false)
    expect(isWorkOrderTaskFilled({ inputType: "Text" }, null)).toBe(false)
    expect(isWorkOrderTaskFilled({ inputType: "Number" }, "0")).toBe(true)
    expect(isWorkOrderTaskFilled({ inputType: "SingleChoice" }, "Ok")).toBe(true)
  })

  it("does not treat a missing image as incomplete", () => {
    expect(isWorkOrderTaskFilled({ inputType: "Image" }, null)).toBe(true)
  })
})
