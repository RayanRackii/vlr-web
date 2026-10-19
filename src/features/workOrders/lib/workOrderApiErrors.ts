import i18n from "@/lib/i18n"
import {
  isUnexpectedApiError,
  readApiErrorBody,
} from "@/lib/apiErrorText"

const CODE_KEYS: Record<string, string> = {
  DUPLICATE_WORK_ORDER: "pmoc.plans.generate.errors.duplicate",
  ASSIGNEE_CANNOT_EXECUTE: "workOrders.errors.assigneeCannotExecute",
  WORK_ORDER_CLOSED: "workOrders.errors.workOrderClosed",
  WORK_ORDER_REOPEN_NOT_ALLOWED: "workOrders.errors.reopenNotAllowed",
  FILE_TOO_LARGE: "workOrders.execution.imageTooLarge",
  FILE_TYPE_NOT_ALLOWED: "workOrders.execution.imageTypeRejected",
  FILE_CONTENT_MISMATCH: "workOrders.execution.imageContentMismatch",
  FORBIDDEN: "rbac.errors.FORBIDDEN",
}

function readIncompleteTaskTitles(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null || !("tasks" in payload)) {
    return []
  }

  const tasks = (payload as { tasks?: unknown }).tasks
  if (!Array.isArray(tasks)) {
    return []
  }

  const titles: string[] = []
  for (const task of tasks) {
    if (typeof task !== "object" || task === null) {
      continue
    }

    const title = (task as { title?: unknown }).title
    if (typeof title !== "string") {
      continue
    }

    const trimmed = title.trim()
    if (trimmed !== "") {
      titles.push(trimmed)
    }
  }

  return titles
}

function mandatoryTasksMessage(payload: unknown): string {
  const titles = readIncompleteTaskTitles(payload)
  if (titles.length === 0) {
    return i18n.t("workOrders.errors.mandatoryTasksIncomplete")
  }

  return i18n.t("workOrders.errors.mandatoryTasksIncompleteList", {
    tasks: titles.join(", "),
  })
}

const TASK_VALUE_REASON_KEYS: Record<string, string> = {
  NOT_A_NUMBER: "workOrders.errors.taskValue.notANumber",
  OUT_OF_RANGE: "workOrders.errors.taskValue.outOfRange",
  NOT_AN_OPTION: "workOrders.errors.taskValue.notAnOption",
  INVALID_CHECKBOX: "workOrders.errors.taskValue.invalidCheckbox",
  TEXT_TOO_LONG: "workOrders.errors.taskValue.textTooLong",
  INVALID_CONFIGURATION: "workOrders.errors.taskValue.invalidConfiguration",
  NOT_AN_IMAGE_TASK: "workOrders.errors.taskValue.notAnImageTask",
  INVALID_IMAGE_REFERENCE: "workOrders.errors.taskValue.invalidImageReference",
}

export function messageForWorkOrderFileError(
  status: number | undefined,
  payload: unknown,
  fallback: string,
): string {
  if (status === 403) {
    return i18n.t("rbac.errors.FORBIDDEN")
  }

  if (status === 404) {
    return i18n.t("workOrders.execution.imageNotFound")
  }

  if (status === 413) {
    return i18n.t("workOrders.execution.imageTooLarge")
  }

  return localizeWorkOrderApiError(payload, fallback)
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

  if (code === "MANDATORY_TASKS_INCOMPLETE") {
    return mandatoryTasksMessage(payload)
  }

  if (code != null && CODE_KEYS[code] != null) {
    return i18n.t(CODE_KEYS[code])
  }

  if (error == null) {
    return fallback
  }

  if (/^Mandatory tasks are incomplete\b/i.test(error)) {
    return mandatoryTasksMessage(payload)
  }

  // The API rejects an ineligible asset with this sentence and no code.
  if (/is not eligible for this maintenance plan/i.test(error)) {
    return i18n.t("workOrders.errors.assetNotEligible")
  }

  if (error === "FORBIDDEN") {
    return i18n.t("rbac.errors.FORBIDDEN")
  }

  if (isUnexpectedApiError(error)) {
    return fallback
  }

  return error
}

export class MandatoryTasksIncompleteError extends Error {
  readonly titles: readonly string[]

  constructor(titles: readonly string[]) {
    const unique = titles
      .map((title) => title.trim())
      .filter((title, index, all) => title !== "" && all.indexOf(title) === index)
    super(
      unique.length === 0
        ? i18n.t("workOrders.errors.mandatoryTasksIncomplete")
        : i18n.t("workOrders.errors.mandatoryTasksIncompleteList", {
            tasks: unique.join(", "),
          }),
    )
    this.name = "MandatoryTasksIncompleteError"
    this.titles = unique
  }
}

function isMandatoryTasksPayload(payload: unknown): boolean {
  const { code, error } = readApiErrorBody(payload)
  return (
    code === "MANDATORY_TASKS_INCOMPLETE" ||
    (error != null && /^Mandatory tasks are incomplete\b/i.test(error))
  )
}

export function errorForWorkOrderStatus(
  payload: unknown,
  fallback: string,
): Error {
  if (isMandatoryTasksPayload(payload)) {
    return new MandatoryTasksIncompleteError(readIncompleteTaskTitles(payload))
  }

  return new Error(localizeWorkOrderApiError(payload, fallback))
}
