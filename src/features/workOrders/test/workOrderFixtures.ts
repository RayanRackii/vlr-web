import {
  CATEGORY_ID,
  PLAN_ID,
  TASK_ID,
  TENANT_ID,
  UNIT_ID,
} from "@/features/pmoc/test/pmocFixtures"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"
import type { WorkOrderRegistryAsset } from "@/features/workOrders/schemas/workOrderSchemas"

export const WORK_ORDER_ID = "99999999-9999-4999-8999-999999999999"
export const WO_ASSET_ID = "12121212-1212-4121-8121-121212121212"
export const TECHNICIAN_ID = "88888888-8888-4888-8888-888888888888"
export const OTHER_UNIT_ID = "14141414-1414-4141-8141-141414141414"

export const matchingRegistryAsset: WorkOrderRegistryAsset = {
  id: WO_ASSET_ID,
  name: "Split sala 1",
  tag: "AC-01",
  unitId: UNIT_ID,
  categoryId: CATEGORY_ID,
  status: "Active",
}

export const otherUnitRegistryAsset: WorkOrderRegistryAsset = {
  id: "13131313-1313-4131-8131-131313131313",
  name: "Split outra unidade",
  tag: "AC-99",
  unitId: OTHER_UNIT_ID,
  categoryId: CATEGORY_ID,
  status: "Active",
}

export const inactiveRegistryAsset: WorkOrderRegistryAsset = {
  id: "15151515-1515-4151-8151-151515151515",
  name: "Split inativo",
  tag: "AC-00",
  unitId: UNIT_ID,
  categoryId: CATEGORY_ID,
  status: "Inactive",
}

export const sampleTechnician = {
  id: TECHNICIAN_ID,
  fullName: "Ana Souza",
  email: "ana@example.com",
}

export function makeWorkOrder(
  overrides: Partial<WorkOrder> = {},
): WorkOrder {
  const id = overrides.id ?? WORK_ORDER_ID

  return {
    id,
    tenantId: TENANT_ID,
    assetId: WO_ASSET_ID,
    maintenancePlanId: PLAN_ID,
    sourcePlanName: "PMOC Split Mensal",
    assignedUserId: null,
    status: "Pending",
    scheduledDate: "2026-09-18",
    completedDate: null,
    notes: null,
    asset: {
      id: WO_ASSET_ID,
      unitId: UNIT_ID,
      categoryId: CATEGORY_ID,
      name: "Split sala 1",
      tag: "AC-01",
      location: "Sala 1",
      status: "Active",
    },
    assignedUser: null,
    tasks: [
      {
        id: "16161616-1616-4161-8161-161616161616",
        tenantId: TENANT_ID,
        workOrderId: id,
        planTaskId: TASK_ID,
        title: "Verificar filtros",
        inputType: "Checkbox",
        configuration: null,
        isMandatory: true,
        order: 1,
        value: null,
        createdAt: "2026-09-18T12:00:00.000Z",
        updatedAt: null,
      },
    ],
    createdAt: "2026-09-18T12:00:00.000Z",
    updatedAt: null,
    ...overrides,
  }
}
