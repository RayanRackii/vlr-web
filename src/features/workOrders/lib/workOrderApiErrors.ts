import i18n from "@/lib/i18n"
import {
  isUnexpectedApiError,
  readApiErrorBody,
} from "@/lib/apiErrorText"

const CODE_KEYS: Record<string, string> = {
  MANDATORY_TASKS_INCOMPLETE: "workOrders.errors.mandatoryTasksIncomplete",
  DUPLICATE_WORK_ORDER: "pmoc.plans.generate.errors.duplicate",
  ASSIGNEE_CANNOT_EXECUTE: "workOrders.errors.assigneeCannotExecute",
  WORK_ORDER_CLOSED: "workOrders.errors.workOrderClosed",
  WORK_ORDER_REOPEN_NOT_ALLOWED: "workOrders.errors.reopenNotAllowed",
}

const TASK_VALUE_REASON_KEYS: Record<string, string> = {
  NOT_A_NUMBER: "workOrders.errors.taskValue.notANumber",
  OUT_OF_RANGE: "workOrders.errors.taskValue.outOfRange",
  NOT_AN_OPTION: "workOrders.errors.taskValue.notAnOption",
  INVALID_CHECKBOX: "workOrders.errors.taskValue.invalidCheckbox",
  TEXT_TOO_LONG: "workOrders.errors.taskValue.textTooLong",
  INVALID_CONFIGURATION: "workOrders.errors.taskValue.invalidConfiguration",
}

export function localizeWorkOrderApiError(
  payload: unknown,
  fallback: string,
): string {
  const { code, error, reason } = readApiErrorBody(payload)

  if (code === "INVALID_TASK_VALUE") {
    if (reason != null && TASK_VALUE_REASON_KEYS[reason] != null) {
      return i18n.t(TASK_VALUE_REASON_KEYS[reason])
    }

    return i18n.t("workOrders.errors.taskValue.invalid")
  }

  if (code != null && CODE_KEYS[code] != null) {
    return i18n.t(CODE_KEYS[code])
  }

  if (error == null) {
    return fallback
  }

  if (/^Mandatory tasks are incomplete\b/i.test(error)) {
    return i18n.t("workOrders.errors.mandatoryTasksIncomplete")
  }

  // The API rejects an ineligible asset with this sentence and no code.
  if (/is not eligible for this maintenance plan/i.test(error)) {
    return i18n.t("workOrders.errors.assetNotEligible")
  }

  if (isUnexpectedApiError(error)) {
    return fallback
  }

  return error
}
