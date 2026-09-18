import type {
  GlobalMaintenanceTemplate,
  GlobalTemplateTask,
} from "@/features/pmoc/schemas/globalTemplateSchemas"
import type {
  MaintenancePlan,
  PlanTask,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"

export const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
export const TEMPLATE_ID = "6f1c2a0e-4b9d-4f3a-9c7e-1d2a3b4c5d6e"
export const TENANT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
export const UNIT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
export const CATEGORY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
export const TASK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
export const TEMPLATE_TASK_ID = "11111111-1111-4111-8111-111111111111"

export const baseTaskJson: PlanTask = {
  id: TASK_ID,
  tenantId: TENANT_ID,
  maintenancePlanId: PLAN_ID,
  title: "Verificar filtros",
  inputType: "Checkbox",
  isMandatory: true,
  order: 1,
  configuration: null,
  createdAt: "2026-09-18T12:00:00.000Z",
  updatedAt: null,
}

export const basePlanJson: MaintenancePlan = {
  id: PLAN_ID,
  tenantId: TENANT_ID,
  unitId: UNIT_ID,
  name: "PMOC Split Mensal",
  description: "Checklist mensal",
  frequency: "Monthly",
  assetCategoryId: CATEGORY_ID,
  isActive: true,
  originKind: "Custom",
  sourceTemplateId: null,
  sourceTemplateVersion: null,
  autoGenerateEnabled: false,
  tasks: [baseTaskJson],
  createdAt: "2026-09-18T12:00:00.000Z",
  updatedAt: null,
}

export const baseTemplateTaskJson: GlobalTemplateTask = {
  id: TEMPLATE_TASK_ID,
  globalMaintenanceTemplateId: TEMPLATE_ID,
  title: "Inspecionar condensadora",
  inputType: "Checkbox",
  configuration: null,
  isMandatory: true,
  order: 1,
  createdAt: "2026-09-18T12:00:00.000Z",
  updatedAt: null,
}

export const baseTemplateJson: GlobalMaintenanceTemplate = {
  id: TEMPLATE_ID,
  name: "PMOC Padrão ANVISA (RE 09) + NR-10",
  description: "Modelo padrão Rolvix",
  frequency: "Monthly",
  jurisdiction: "BR",
  targetEquipmentType: "Ar-condicionado",
  libraryKey: "pmoc-ar-condicionado-anvisa-nr10",
  version: 1,
  status: "Published",
  sourceReferences:
    "Lei 13.589/2018; Resolução Anvisa RE 09; NR-10",
  tasks: [baseTemplateTaskJson],
  createdAt: "2026-09-18T12:00:00.000Z",
  updatedAt: null,
}

export const samplePlan = basePlanJson
export const sampleTemplate = baseTemplateJson
