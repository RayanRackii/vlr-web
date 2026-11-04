import { describe, expect, it } from "vitest"
import { catalogProductFileSchema } from "./catalogSchemas"

const file = {
  id: "11111111-1111-4111-8111-111111111111",
  fileName: "photo.png",
  mimeType: "image/png",
  sizeBytes: 100,
  visibility: "CustomerVisible",
  url: null,
}

describe("catalog product file status", () => {
  it.each(["Ready", "Pending", "Failed"])("preserves the API status %s", (status) => {
    expect(catalogProductFileSchema.parse({ ...file, status }).status).toBe(status)
  })

  it("defaults a missing status to Ready", () => {
    expect(catalogProductFileSchema.parse(file).status).toBe("Ready")
  })

  it("rejects an unknown status", () => {
    expect(catalogProductFileSchema.safeParse({ ...file, status: "Uploading" }).success).toBe(false)
  })
})
