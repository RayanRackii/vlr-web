import { describe, expect, it } from "vitest"

import { globalMaintenanceTemplateSchema } from "@/features/pmoc/schemas/globalTemplateSchemas"
import { baseTemplateJson } from "@/features/pmoc/test/pmocFixtures"

describe("globalMaintenanceTemplateSchema Phase 1 fields", () => {
  it("parses libraryKey, version, status, and sourceReferences", () => {
    const parsed = globalMaintenanceTemplateSchema.safeParse(baseTemplateJson)

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    expect(parsed.data.libraryKey).toBe("pmoc-ar-condicionado-anvisa-nr10")
    expect(parsed.data.version).toBe(1)
    expect(parsed.data.status).toBe("Published")
    expect(parsed.data.sourceReferences).toContain("Lei 13.589/2018")
  })

  it("accepts numeric status 1 as Deprecated", () => {
    const parsed = globalMaintenanceTemplateSchema.safeParse({
      ...baseTemplateJson,
      status: 1,
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    expect(parsed.data.status).toBe("Deprecated")
  })

  it("strips unknown keys because the schema is not strict", () => {
    const parsed = globalMaintenanceTemplateSchema.safeParse({
      ...baseTemplateJson,
      extraField: true,
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    expect("extraField" in parsed.data).toBe(false)
  })
})
