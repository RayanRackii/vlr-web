import { describe, expect, it } from "vitest"

import { taxonomyMutationSchema } from "@/features/taxonomy/schemas/taxonomySchemas"

describe("taxonomy schemas", () => {
  it("accepts the API category constraints", () => {
    expect(taxonomyMutationSchema.safeParse({ name: "Chairs", slug: "chairs", parentId: null, icon: "folder", sortOrder: 0 }).success).toBe(true)
  })

  it("rejects an invalid immutable slug", () => {
    expect(taxonomyMutationSchema.safeParse({ name: "Chairs", slug: "Cadeiras livres", parentId: null, icon: null, sortOrder: 0 }).success).toBe(false)
  })
})
