import i18n from "@/lib/i18n"
import {
  isUnexpectedApiError,
  readApiErrorBody,
} from "@/lib/apiErrorText"

const CODE_KEYS: Record<string, string> = {
  MANDATORY_TASKS_INCOMPLETE: "workOrders.errors.mandatoryTasksIncomplete",
  ASSET_NOT_ELIGIBLE: "workOrders.errors.assetNotEligible",
}

export function localizeWorkOrderApiError(
  payload: unknown,
  fallback: string,
): string {
  const { code, error } = readApiErrorBody(payload)

  if (code != null && CODE_KEYS[code] != null) {
    return i18n.t(CODE_KEYS[code])
  }

  if (error == null) {
    return fallback
  }

  if (/^Mandatory tasks are incomplete\b/i.test(error)) {
    return i18n.t("workOrders.errors.mandatoryTasksIncomplete")
  }

  if (/is not eligible for this maintenance plan/i.test(error)) {
    return i18n.t("workOrders.errors.assetNotEligible")
  }

  if (isUnexpectedApiError(error)) {
    return fallback
  }

  return error
}
