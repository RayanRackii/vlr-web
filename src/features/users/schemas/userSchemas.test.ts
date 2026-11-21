import { describe, expect, it } from "vitest"

import { currentUserSchema } from "@/features/users/schemas/userSchemas"

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Ana",
  email: "ana@example.com",
}

describe("currentUserSchema", () => {
  it("accepts a role value this build does not know", () => {
    const parsed = currentUserSchema.safeParse({ ...base, role: "SUPERVISOR" })

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.role).toBe("SUPERVISOR")
  })

  it("still accepts the known roles", () => {
    expect(currentUserSchema.parse({ ...base, role: "ADMIN" }).role).toBe("ADMIN")
  })
})
