import type { AxiosProgressEvent } from "axios"

import i18n from "@/lib/i18n"
import { localizeMaintenancePlanApiError } from "@/features/pmoc/lib/localizeMaintenancePlanError"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import { isEffectivelyOnline } from "@/lib/connectivity"
import {
  errorForWorkOrderStatus,
  localizeWorkOrderApiError,
  messageForWorkOrderFileError,
} from "@/features/workOrders/lib/workOrderApiErrors"
import { mapRbacErrorMessage } from "@/features/users/permissions/rbacErrors"
import {
  commitDirectTaskValuePatch,
  enqueueTaskValuePatch,
  isNetworkConnectivityError,
} from "@/lib/offlineSync"
import {
  createWorkOrderRequestSchema,
  generateWorkOrderFromPlanRequestSchema,
  updateWorkOrderAssigneeRequestSchema,
  updateWorkOrderStatusRequestSchema,
  updateWorkOrderTaskValueRequestSchema,
  workOrderListSchema,
  workOrderRegistryAssetListSchema,
  workOrderSchema,
  workOrderTaskFileSchema,
  workOrderTaskFileUrlSchema,
  type CreateWorkOrderRequest,
  type GenerateWorkOrderFromPlanRequest,
  type UpdateWorkOrderStatusRequest,
  type WorkOrder,
  type WorkOrderRegistryAsset,
  type WorkOrderTaskFile,
  type WorkOrderTaskFileUrl,
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

function throwWorkOrderReadError(error: unknown, fallbackKey: string): never {
  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }

  if (isAxiosError(error)) {
    const status = error.response?.status
    if (status === 403 || status === 404) {
      throw new Error(i18n.t("workOrders.errors.notAssignedOrForbidden"))
    }
  }

  const fallback = i18n.t(fallbackKey)
  throw new Error(
    mapRbacErrorMessage(
      localizeWorkOrderApiError(getAxiosErrorPayload(error), fallback),
      fallback,
    ),
  )
}

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

    throwWorkOrderReadError(error, "workOrders.errors.loadFailed")
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

    const payload = getAxiosErrorPayload(error)
    throw new Error(
      localizeMaintenancePlanApiError(
        localizeWorkOrderApiError(
          payload,
          i18n.t("pmoc.plans.generate.errors.generateFailed"),
        ),
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

    throwWorkOrderReadError(error, "workOrders.errors.loadOneFailed")
  }
}

export async function updateTaskValue(
  workOrderId: string,
  taskId: string,
  value: string | null,
): Promise<WorkOrder | null> {
  const payload = updateWorkOrderTaskValueRequestSchema.parse({ value })
  const patch: {
    workOrderId: string
    taskId: string
    value: string | null
  } = {
    workOrderId,
    taskId,
    value: payload.value ?? null,
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueTaskValuePatch(patch)
    return null
  }

  try {
    const outcome = await commitDirectTaskValuePatch(patch, async (signal) => {
      const response = await api.patch<unknown>(
        `${WORK_ORDERS_PATH}/${workOrderId}/tasks/${taskId}`,
        payload,
        { signal },
      )
      return response.data
    })

    if (outcome.status === "queued") {
      return null
    }

    // A 2xx already applied the value. Parsing inside `send` would leave that
    // version queued, and a later flush would send it again.
    const parsed = workOrderSchema.safeParse(outcome.value)

    if (!parsed.success) {
      console.error("updateTaskValue Zod validation failed", {
        data: outcome.value,
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

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      localizeWorkOrderApiError(
        getAxiosErrorPayload(error),
        i18n.t("workOrders.errors.updateTaskFailed"),
      ),
    )
  }
}

export type WorkOrderTaskFileProgress = (percent: number | null) => void

function taskFilePath(workOrderId: string, taskId: string): string {
  return `${WORK_ORDERS_PATH}/${workOrderId}/tasks/${taskId}/files`
}

function throwWorkOrderFileError(error: unknown, fallback: string): never {
  if (isNetworkConnectivityError(error) || !isEffectivelyOnline()) {
    throw new Error(i18n.t("workOrders.execution.imageOffline"), { cause: error })
  }

  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }

  const status = isAxiosError(error) ? error.response?.status : undefined
  throw new Error(
    messageForWorkOrderFileError(status, getAxiosErrorPayload(error), fallback),
    { cause: error },
  )
}

/**
 * Stores a jpeg, png, or webp on an image task. The API writes the file id
 * into the task answer. This does not PATCH the task and does not queue the blob.
 */
export async function uploadWorkOrderTaskFile(
  workOrderId: string,
  taskId: string,
  file: File,
  onProgress?: WorkOrderTaskFileProgress,
): Promise<WorkOrderTaskFile> {
  if (!isEffectivelyOnline()) {
    throw new Error(i18n.t("workOrders.execution.imageOffline"))
  }

  const formData = new FormData()
  formData.append("file", file, file.name)

  try {
    const response = await api.post<unknown>(
      taskFilePath(workOrderId, taskId),
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event: AxiosProgressEvent) => {
          if (!onProgress) {
            return
          }

          const total = event.total
          if (total == null || total <= 0) {
            onProgress(null)
            return
          }

          onProgress(Math.min(100, Math.round((event.loaded / total) * 100)))
        },
      },
    )
    const parsed = workOrderTaskFileSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("workOrders.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("uploadWorkOrderTaskFile failed", error)
    if (isAxiosError(error)) {
      console.error("uploadWorkOrderTaskFile response", error.response?.data)
    }

    throwWorkOrderFileError(
      error,
      i18n.t("workOrders.execution.imageUploadFailed"),
    )
  }
}

export async function getWorkOrderTaskFileUrl(
  workOrderId: string,
  taskId: string,
  fileId: string,
): Promise<WorkOrderTaskFileUrl> {
  if (!isEffectivelyOnline()) {
    throw new Error(i18n.t("workOrders.execution.imageOffline"))
  }

  try {
    const response = await api.get<unknown>(
      `${taskFilePath(workOrderId, taskId)}/${fileId}/url`,
    )
    const parsed = workOrderTaskFileUrlSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("workOrders.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("getWorkOrderTaskFileUrl failed", error)
    if (isAxiosError(error)) {
      console.error("getWorkOrderTaskFileUrl response", error.response?.data)
    }

    throwWorkOrderFileError(
      error,
      i18n.t("workOrders.execution.imagePreviewFailed"),
    )
  }
}

export async function updateWorkOrderAssignee(
  workOrderId: string,
  assignedUserId: string | null,
): Promise<WorkOrder> {
  const payload = updateWorkOrderAssigneeRequestSchema.parse({
    assignedUserId,
  })

  try {
    const response = await api.put<unknown>(
      `${WORK_ORDERS_PATH}/${workOrderId}/assignee`,
      payload,
    )
    const parsed = workOrderSchema.safeParse(response.data)

    if (!parsed.success) {
      throw new Error(i18n.t("workOrders.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    const fallback = i18n.t("workOrders.errors.assignFailed")
    throw new Error(
      mapRbacErrorMessage(
        localizeWorkOrderApiError(getAxiosErrorPayload(error), fallback),
        fallback,
      ),
    )
  }
}

export async function updateWorkOrderStatus(
  workOrderId: string,
  status: UpdateWorkOrderStatusRequest["status"],
): Promise<WorkOrder> {
  const payload = updateWorkOrderStatusRequestSchema.parse({ status })

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      status === "InProgress"
        ? i18n.t("workOrders.offline.startFailed")
        : i18n.t("workOrders.offline.statusFailed"),
    )
  }

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

    if (isNetworkConnectivityError(error)) {
      throw new Error(
        status === "InProgress"
          ? i18n.t("workOrders.offline.startFailed")
          : i18n.t("workOrders.offline.statusFailed"),
      )
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw errorForWorkOrderStatus(
      getAxiosErrorPayload(error),
      i18n.t("workOrders.errors.updateStatusFailed"),
    )
  }
}
