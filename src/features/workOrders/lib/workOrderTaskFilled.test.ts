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

  it("treats an image as filled only when the value is a stored file id", () => {
    expect(
      isWorkOrderTaskFilled(
        { inputType: "Image" },
        "3f1c2a0e-4b9d-4f3a-9c7e-1d2a3b4c5d6e",
      ),
    ).toBe(true)
    expect(isWorkOrderTaskFilled({ inputType: "Image" }, null)).toBe(false)
    expect(isWorkOrderTaskFilled({ inputType: "Image" }, "")).toBe(false)
    expect(
      isWorkOrderTaskFilled(
        { inputType: "Image" },
        "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      ),
    ).toBe(false)
  })
})
