import { z } from "zod"
import { api, getAxiosErrorPayload, isAxiosError } from "@/lib/api"
import {
  allocationListSchema,
  allocationSchema,
  conflictSchema,
  planningAgendaSchema,
  planningAssetListSchema,
  previewSchema,
  type AllocationPreview,
  type CreateAllocationRequest,
  type PlanningAgenda,
  type PlanningAllocation,
  type PlanningAsset,
  type PlanningConflict,
  type UpdateAllocationRequest,
  type UsageRequest,
} from "../schemas/planningSchemas"

/** A failed planning call with the stable `code` and the detail the API returns for it. */
export class PlanningApiError extends Error {
  readonly status: number
  readonly code: string
  readonly conflicts: PlanningConflict[]
  readonly hoursViolation: string | null

  constructor(status: number, code: string, message: string, conflicts: PlanningConflict[] = [], hoursViolation: string | null = null) {
    super(message)
    this.name = "PlanningApiError"
    this.status = status
    this.code = code
    this.conflicts = conflicts
    this.hoursViolation = hoursViolation
  }
}

const errorBodySchema = z.object({
  error: z.string().nullish(),
  code: z.string().nullish(),
  errorCode: z.string().nullish(),
  conflicts: z.array(conflictSchema).nullish(),
  hoursViolation: z.string().nullish(),
})

function toPlanningError(error: unknown): unknown {
  if (!isAxiosError(error)) return error
  const status = error.response?.status ?? 0
  const body = errorBodySchema.safeParse(getAxiosErrorPayload(error))
  const data = body.success ? body.data : null
  const code = data?.code ?? data?.errorCode ?? (data?.error === "module_inactive" ? "module_inactive" : status === 0 ? "network" : `http_${status}`)
  return new PlanningApiError(status, code, data?.error ?? error.message, data?.conflicts ?? [], data?.hoursViolation ?? null)
}

async function call<T>(request: () => Promise<{ data: unknown }>, schema: z.ZodType<T>): Promise<T> {
  try {
    const response = await request()
    return schema.parse(response.data)
  } catch (error) {
    if (error instanceof z.ZodError) throw new PlanningApiError(0, "invalid_response", error.message)
    throw toPlanningError(error)
  }
}

export function listPlanningAssets(plannable: "true" | "false" | "all" = "true"): Promise<PlanningAsset[]> {
  return call(() => api.get<unknown>("/api/planning/assets", { params: { plannable } }), planningAssetListSchema)
}

export type AgendaQuery = { from: string; to: string; assetIds?: readonly string[]; unitId?: string | null }

export function getPlanningAgenda(query: AgendaQuery): Promise<PlanningAgenda> {
  const params = new URLSearchParams({ from: query.from, to: query.to })
  for (const id of query.assetIds ?? []) params.append("assetIds", id)
  if (query.unitId) params.set("unitId", query.unitId)
  return call(() => api.get<unknown>("/api/planning/agenda", { params }), planningAgendaSchema)
}

export function previewAllocation(body: CreateAllocationRequest): Promise<AllocationPreview> {
  return call(() => api.post<unknown>("/api/planning/allocations/preview", body), previewSchema)
}

export function createAllocation(body: CreateAllocationRequest): Promise<PlanningAllocation> {
  return call(() => api.post<unknown>("/api/planning/allocations", body), allocationSchema)
}

export function getAllocation(id: string): Promise<PlanningAllocation> {
  return call(() => api.get<unknown>(`/api/planning/allocations/${encodeURIComponent(id)}`), allocationSchema)
}

export function listAllocations(filter: { assetId?: string; status?: string } = {}): Promise<PlanningAllocation[]> {
  return call(() => api.get<unknown>("/api/planning/allocations", { params: filter }), allocationListSchema)
}

export function updateAllocation(id: string, body: UpdateAllocationRequest): Promise<PlanningAllocation> {
  return call(() => api.patch<unknown>(`/api/planning/allocations/${encodeURIComponent(id)}`, body), allocationSchema)
}

export function runAllocationUsage(id: string, body: UsageRequest): Promise<PlanningAllocation> {
  return call(() => api.post<unknown>(`/api/planning/allocations/${encodeURIComponent(id)}/usage`, body), allocationSchema)
}
