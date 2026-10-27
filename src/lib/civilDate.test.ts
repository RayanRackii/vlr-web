import { describe, expect, it } from "vitest"

import { civilDateFormSchema } from "@/lib/civilDate"

describe("civilDateFormSchema", () => {
  const schema = civilDateFormSchema("Date required", "Invalid date", {
    min: { value: "2026-10-08", message: "Date is too early" },
    max: { value: "2026-10-14", message: "Date is too late" },
  })

  it.each([
    ["", "Date required"],
    ["14/", "Invalid date"],
    ["2026-02-31", "Invalid date"],
    ["2026-10-07", "Date is too early"],
    ["2026-10-15", "Date is too late"],
  ])("gives a single specific error for %s", (value, message) => {
    const result = schema.safeParse(value)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((issue) => issue.message)).toEqual([message])
  })

  it.each(["2026-10-08", "2026-10-10", "2026-10-14"])("accepts date %s within inclusive bounds", (value) => {
    expect(schema.parse(value)).toBe(value)
  })
})
