import type { TFunction } from "i18next"
import i18n from "@/lib/i18n"
import { PlanningApiError } from "../services/planningService"
import type { PlanningConflict } from "../schemas/planningSchemas"

export type DescribedError = {
  message: string
  conflicts: PlanningConflict[]
  /** Readable reason when the failure is a working-hours rejection. */
  hoursViolation: string | null
  code: string
}

/** Codes the API returns that have their own message. Anything else falls back by status. */
export const knownPlanningErrorCodes = [
  "planning.conflict",
  "planning.version_conflict",
  "planning.asset_not_plannable",
  "planning.invalid_transition",
  "planning.outside_working_hours",
  "planning.cancel_forbidden",
  "planning.unavailable_forbidden",
  "planning.order_workflow_required",
  "planning.asset_not_found",
  "planning.allocation_not_found",
  "planning.invalid_allocation",
  "planning.invalid_range",
  "planning.invalid_profile",
  "planning.working_hours_required",
  "planning.rental_schedule_authority",
  "module_inactive",
] as const

const hoursReasons = ["start_outside_working_hours", "outside_working_hours", "invalid_interval"] as const

const keyOf = (code: string) => code.replace(/^planning\./, "")

/** Why an asset's working hours reject a window, in the viewer's language. */
export function hoursViolationMessage(reason: string | null, t: TFunction = i18n.t.bind(i18n) as TFunction): string {
  const known = (hoursReasons as readonly string[]).includes(reason ?? "") ? reason : "outside_working_hours"
  return t(`planning.hours.${known}`)
}

export function describePlanningError(error: unknown, t: TFunction = i18n.t.bind(i18n) as TFunction): DescribedError {
  if (!(error instanceof PlanningApiError)) {
    return { message: t("planning.errors.unknown"), conflicts: [], hoursViolation: null, code: "unknown" }
  }
  const known = (knownPlanningErrorCodes as readonly string[]).includes(error.code)
  let message: string
  if (known) message = t(`planning.errors.${keyOf(error.code)}`)
  else if (error.code === "network") message = t("planning.errors.network")
  else if (error.status === 403) message = t("planning.errors.forbidden")
  else if (error.status >= 500) message = t("planning.errors.server")
  else message = t("planning.errors.unknown")
  const hoursViolation = error.code === "planning.outside_working_hours" ? error.hoursViolation ?? "outside_working_hours" : null
  if (hoursViolation) message = `${message} ${hoursViolationMessage(hoursViolation, t)}`
  return { message, conflicts: error.conflicts, hoursViolation, code: error.code }
}
