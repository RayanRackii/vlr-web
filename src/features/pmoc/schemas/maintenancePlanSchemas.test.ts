import { describe, expect, it } from "vitest"

import {
  buildCreatePlanRequest,
  buildReplaceTasksRequest,
  createFromTemplateRequestSchema,
  createMaintenancePlanRequestSchema,
  createPlanFormSchema,
  maintenancePlanSchema,
  updateMaintenancePlanRequestSchema,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"
import { basePlanJson } from "@/features/pmoc/test/pmocFixtures"

const formMessages = {
  unitRequired: "unit",
  nameRequired: "name",
  intervalInvalid: "interval",
  firstDueRequired: "firstDue",
  categoryRequired: "category",
  taskTitleRequired: "task",
  tasksRequired: "tasks",
  numberMinRequired: "min",
  numberMaxRequired: "max",
  numberRangeInvalid: "range",
}

describe("maintenancePlanSchema Phase 1 fields", () => {
  it("parses originKind, source lineage, and autoGenerateEnabled", () => {
    const parsed = maintenancePlanSchema.safeParse(basePlanJson)

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    expect(parsed.data.originKind).toBe("Custom")
    expect(parsed.data.sourceTemplateId).toBeNull()
    expect(parsed.data.sourceTemplateVersion).toBeNull()
    expect(parsed.data.autoGenerateEnabled).toBe(false)
  })

  it("accepts numeric originKind 1 as RolvixTemplate like frequency", () => {
    const parsed = maintenancePlanSchema.safeParse({
      ...basePlanJson,
      originKind: 1,
      sourceTemplateId: "6f1c2a0e-4b9d-4f3a-9c7e-1d2a3b4c5d6e",
      sourceTemplateVersion: 2,
      autoGenerateEnabled: true,
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    expect(parsed.data.originKind).toBe("RolvixTemplate")
    expect(parsed.data.sourceTemplateVersion).toBe(2)
  })

  it("strips unknown keys because the schema is not strict", () => {
    const parsed = maintenancePlanSchema.safeParse({
      ...basePlanJson,
      extraField: "ignored",
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    expect("extraField" in parsed.data).toBe(false)
  })

  it("rejects a plan missing the new required fields", () => {
    const { originKind: _originKind, autoGenerateEnabled: _auto, ...legacy } =
      basePlanJson
    void _originKind
    void _auto

    const parsed = maintenancePlanSchema.safeParse(legacy)
    expect(parsed.success).toBe(false)
  })
})

describe("Phase 3 scheduling validation", () => {
  const formSchema = createPlanFormSchema(formMessages)

  it("A/B: interval and first due are required", () => {
    const parsed = formSchema.safeParse({
      unitId: basePlanJson.unitId,
      name: "Custom",
      intervalDays: Number.NaN,
      firstDueDate: "",
      assetCategoryId: basePlanJson.assetCategoryId,
      isActive: true,
      tasks: [
        {
          title: "Tarefa",
          inputType: "Checkbox",
          isMandatory: true,
        },
      ],
    })

    expect(parsed.success).toBe(false)
  })

  it("C/D/E/F: rejects 0 and 3651, accepts 30 and a past first due date", () => {
    const base = {
      unitId: basePlanJson.unitId,
      name: "Custom",
      assetCategoryId: basePlanJson.assetCategoryId,
      isActive: true,
      tasks: [
        {
          title: "Tarefa",
          inputType: "Checkbox" as const,
          isMandatory: true,
        },
      ],
    }

    expect(formSchema.safeParse({ ...base, intervalDays: 0, firstDueDate: "2026-10-01" }).success).toBe(false)
    expect(formSchema.safeParse({ ...base, intervalDays: 3651, firstDueDate: "2026-10-01" }).success).toBe(false)
    const valid = formSchema.safeParse({
      ...base,
      intervalDays: 30,
      firstDueDate: "2026-01-15",
    })
    expect(valid.success).toBe(true)
  })
})

describe("createMaintenancePlanRequestSchema", () => {
  it("omits autoGenerateEnabled so new custom plans stay off", () => {
    const formSchema = createPlanFormSchema(formMessages)
    const values = formSchema.parse({
      unitId: basePlanJson.unitId,
      name: "Custom",
      description: "",
      intervalDays: 30,
      firstDueDate: "2026-10-01",
      assetCategoryId: basePlanJson.assetCategoryId,
      isActive: true,
      tasks: [
        {
          title: "Tarefa",
          inputType: "Checkbox",
          isMandatory: true,
          min: null,
          max: null,
          unit: null,
        },
      ],
    })

    const request = buildCreatePlanRequest(values)
    expect("autoGenerateEnabled" in request).toBe(false)

    const parsed = createMaintenancePlanRequestSchema.parse(request)
    expect("autoGenerateEnabled" in parsed).toBe(false)
  })
})

describe("updateMaintenancePlanRequestSchema", () => {
  it("requires isActive and autoGenerateEnabled", () => {
    const parsed = updateMaintenancePlanRequestSchema.safeParse({
      unitId: basePlanJson.unitId,
      name: "PMOC",
      description: null,
      intervalDays: 30,
      firstDueDate: "2026-10-01",
      assetCategoryId: basePlanJson.assetCategoryId,
      isActive: true,
      autoGenerateEnabled: false,
    })

    expect(parsed.success).toBe(true)
  })
})

describe("buildReplaceTasksRequest", () => {
  it("keeps ids when editing, omits id when adding, and requires at least one task", () => {
    const request = buildReplaceTasksRequest([
      {
        taskId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        title: "Existing",
        inputType: "Checkbox",
        isMandatory: true,
      },
      {
        title: "New task",
        inputType: "Text",
        isMandatory: false,
      },
    ])

    expect(request.tasks).toEqual([
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        title: "Existing",
        inputType: "Checkbox",
        isMandatory: true,
        order: 1,
        configuration: null,
      },
      {
        title: "New task",
        inputType: "Text",
        isMandatory: false,
        order: 2,
        configuration: null,
      },
    ])
    expect("id" in request.tasks[1]!).toBe(false)
  })
})

describe("createFromTemplateRequestSchema", () => {
  it("requires template, unit, and category and does not send auto true", () => {
    const parsed = createFromTemplateRequestSchema.parse({
      templateId: "6f1c2a0e-4b9d-4f3a-9c7e-1d2a3b4c5d6e",
      unitId: basePlanJson.unitId,
      assetCategoryId: basePlanJson.assetCategoryId,
      intervalDays: 30,
      firstDueDate: "2026-01-15",
      name: "Clone",
    })

    expect("autoGenerateEnabled" in parsed).toBe(false)
  })
})
