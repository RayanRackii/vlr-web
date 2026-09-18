import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import {
  enqueueTaskValuePatch,
  isNetworkConnectivityError,
} from "@/lib/offlineSync"
import {
  createWorkOrderRequestSchema,
  generateWorkOrderFromPlanRequestSchema,
  updateWorkOrderStatusRequestSchema,
  updateWorkOrderTaskValueRequestSchema,
  workOrderListSchema,
  workOrderRegistryAssetListSchema,
  workOrderSchema,
  type CreateWorkOrderRequest,
  type GenerateWorkOrderFromPlanRequest,
  type UpdateWorkOrderStatusRequest,
  type WorkOrder,
  type WorkOrderRegistryAsset,
} from "@/features/workOrders/schemas/workOrderSchemas"

export const DUPLICATE_WORK_ORDER_CODE = "DUPLICATE_WORK_ORDER"

export class DuplicateWorkOrderError extends Error {
  readonly code = DUPLICATE_WORK_ORDER_CODE

  constructor(message: string) {
    super(message)
    this.name = "DuplicateWorkOrderError"
  }
}

export function isDuplicateWorkOrderError(
  error: unknown,
): error is DuplicateWorkOrderError {
  return error instanceof DuplicateWorkOrderError
}

const WORK_ORDERS_PATH = "/api/work-orders"

export async function listWorkOrderAssets(): Promise<WorkOrderRegistryAsset[]> {
  try {
    const response = await api.get<unknown>(`${WORK_ORDERS_PATH}/assets`)
    const parsed = workOrderRegistryAssetListSchema.safeParse(response.data)

    if (!parsed.success) {
      throw new Error(i18n.t("workOrders.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("workOrders.create.errors.loadLookupsFailed"),
      ),
    )
  }
}

export async function createWorkOrder(
  data: CreateWorkOrderRequest,
): Promise<WorkOrder> {
  const payload = createWorkOrderRequestSchema.parse(data)

  try {
    const response = await api.post<unknown>(WORK_ORDERS_PATH, payload)
    return workOrderSchema.parse(response.data)
  } catch (error: unknown) {
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("workOrders.create.errors.createFailed"),
      ),
    )
  }
}

export async function getWorkOrders(filters?: {
  assetId?: string
  maintenancePlanId?: string
}): Promise<WorkOrder[]> {
  try {
    const params: Record<string, string> = {}
    if (filters?.assetId) {
      params.assetId = filters.assetId
    }
    if (filters?.maintenancePlanId) {
      params.maintenancePlanId = filters.maintenancePlanId
    }

    const response = await api.get<unknown>(WORK_ORDERS_PATH, {
      params: Object.keys(params).length > 0 ? params : undefined,
    })
    const parsed = workOrderListSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("getWorkOrders Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("workOrders.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("getWorkOrders failed", error)
    if (isAxiosError(error)) {
      console.error("getWorkOrders response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("workOrders.errors.loadFailed"),
      ),
    )
  }
}

export async function generateWorkOrderFromPlan(
  data: GenerateWorkOrderFromPlanRequest,
): Promise<WorkOrder> {
  const payload = generateWorkOrderFromPlanRequestSchema.parse(data)

  try {
    const response = await api.post<unknown>(
      `${WORK_ORDERS_PATH}/from-plan`,
      payload,
    )
    return workOrderSchema.parse(response.data)
  } catch (error: unknown) {
    if (error instanceof DuplicateWorkOrderError) {
      throw error
    }

    if (isAxiosError(error) && error.response?.status === 409) {
      const errorPayload = getAxiosErrorPayload(error)
      if (
        typeof errorPayload === "object" &&
        errorPayload !== null &&
        "code" in errorPayload &&
        errorPayload.code === DUPLICATE_WORK_ORDER_CODE
      ) {
        throw new DuplicateWorkOrderError(
          i18n.t("pmoc.plans.generate.errors.duplicate"),
        )
      }
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("pmoc.plans.generate.errors.generateFailed"),
      ),
    )
  }
}

export async function getWorkOrderById(id: string): Promise<WorkOrder> {
  try {
    const response = await api.get<unknown>(`${WORK_ORDERS_PATH}/${id}`)
    const parsed = workOrderSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("getWorkOrderById Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("workOrders.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("getWorkOrderById failed", error)
    if (isAxiosError(error)) {
      console.error("getWorkOrderById response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("workOrders.errors.loadOneFailed"),
      ),
    )
  }
}

export async function updateTaskValue(
  workOrderId: string,
  taskId: string,
  value: string | null,
): Promise<WorkOrder | null> {
  const payload = updateWorkOrderTaskValueRequestSchema.parse({ value })

  const queueAndSucceed = async (): Promise<null> => {
    await enqueueTaskValuePatch({
      workOrderId,
      taskId,
      value: payload.value ?? null,
    })
    return null
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return queueAndSucceed()
  }

  try {
    const response = await api.patch<unknown>(
      `${WORK_ORDERS_PATH}/${workOrderId}/tasks/${taskId}`,
      payload,
    )
    const parsed = workOrderSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("updateTaskValue Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("workOrders.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("updateTaskValue failed", error)
    if (isAxiosError(error)) {
      console.error("updateTaskValue response data", error.response?.data)
    }

    if (isNetworkConnectivityError(error)) {
      return queueAndSucceed()
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("workOrders.errors.updateTaskFailed"),
      ),
    )
  }
}

export async function updateWorkOrderStatus(
  workOrderId: string,
  status: UpdateWorkOrderStatusRequest["status"],
): Promise<WorkOrder> {
  const payload = updateWorkOrderStatusRequestSchema.parse({ status })

  try {
    const response = await api.patch<unknown>(
      `${WORK_ORDERS_PATH}/${workOrderId}/status`,
      payload,
    )
    const parsed = workOrderSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("updateWorkOrderStatus Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("workOrders.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("updateWorkOrderStatus failed", error)
    if (isAxiosError(error)) {
      console.error("updateWorkOrderStatus response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("workOrders.errors.updateStatusFailed"),
      ),
    )
  }
}
