import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import {
  enqueueTaskValuePatch,
  isNetworkConnectivityError,
} from "@/lib/offlineSync"
import {
  updateWorkOrderStatusRequestSchema,
  updateWorkOrderTaskValueRequestSchema,
  workOrderListSchema,
  workOrderSchema,
  type UpdateWorkOrderStatusRequest,
  type WorkOrder,
} from "@/features/workOrders/schemas/workOrderSchemas"

const WORK_ORDERS_PATH = "/api/work-orders"

export async function getWorkOrders(): Promise<WorkOrder[]> {
  try {
    const response = await api.get<unknown>(WORK_ORDERS_PATH)
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
