import { isAxiosError } from "@/lib/api"
import i18n from "@/lib/i18n"

/** Where "ver planos" goes. `/configuracoes/plano` (B5) replaces this once it exists. */
export const PLAN_PAGE_PATH = "/precos"

export const PLAN_LIMIT_CODE = "plan.limit_reached"

export type PlanLimitDetails = {
  limit: string | null
  current: number | null
  max: number | null
  planKey: string | null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** Tolerant reader for the 409 body `{ error, code: "plan.limit_reached", limit, current, max, planKey }`. */
export function readPlanLimit(payload: unknown): PlanLimitDetails | null {
  if (typeof payload !== "object" || payload === null) {
    return null
  }
  const record = payload as Record<string, unknown>
  if (record.code !== PLAN_LIMIT_CODE) {
    return null
  }
  return {
    limit: typeof record.limit === "string" ? record.limit : null,
    current: asNumber(record.current),
    max: asNumber(record.max),
    planKey: typeof record.planKey === "string" ? record.planKey : null,
  }
}

export function planLimitMessage(): string {
  return i18n.t("apiErrors.planLimitReached")
}

/** An Error whose message is already the localized "Limite do plano atingido" text. */
export class PlanLimitError extends Error {
  readonly details: PlanLimitDetails

  constructor(details: PlanLimitDetails, options?: ErrorOptions) {
    super(planLimitMessage(), options)
    this.name = "PlanLimitError"
    this.details = details
  }
}

export function isPlanLimitError(error: unknown): error is PlanLimitError {
  return error instanceof PlanLimitError
}

/** Returns a `PlanLimitError` when the axios error is a plan limit refusal, otherwise null. */
export function toPlanLimitError(error: unknown): PlanLimitError | null {
  if (!isAxiosError(error) || error.response?.status !== 409) {
    return null
  }
  const details = readPlanLimit(error.response.data)
  return details ? new PlanLimitError(details, { cause: error }) : null
}
