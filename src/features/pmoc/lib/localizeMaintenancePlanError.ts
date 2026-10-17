import i18n from "@/lib/i18n"

export const INACTIVE_MAINTENANCE_PLAN_ERROR = "Maintenance plan is not active."

export function localizeMaintenancePlanApiError(message: string): string {
  if (message.trim() === INACTIVE_MAINTENANCE_PLAN_ERROR) {
    return i18n.t("pmoc.plans.generate.errors.planInactive")
  }

  return message
}
