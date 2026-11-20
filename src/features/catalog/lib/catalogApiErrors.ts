import i18n from "@/lib/i18n"
import { hoursViolationMessage } from "@/features/planning/model/planningErrors"
import {
  isModuleInactiveValue,
  isUnexpectedApiError,
  readApiErrorBody,
} from "@/lib/apiErrorText"

const MESSAGE_KEYS: Record<string, string> = {
  "A product with this code already exists.":
    "catalog.products.errors.duplicateCode",
  "Customer group is referenced by product access.":
    "catalog.customerGroups.errors.inUse",
  "Customer-visible images must be between 1 byte and 5 MB.":
    "catalog.products.files.tooLargeCustomer",
  "Customer-visible files must be jpeg, png, or webp.":
    "catalog.products.files.typeCustomer",
  "File content does not match the declared image type.":
    "catalog.products.files.contentMismatch",
  "File extension is required.": "catalog.products.files.extensionRequired",
  "Internal files must be between 1 byte and 25 MB.":
    "catalog.products.files.tooLargeInternal",
  "Internal files must be pdf, stl, step, stp, or dxf.":
    "catalog.products.files.typeInternal",
  "File content does not match the declared PDF type.":
    "catalog.products.files.contentMismatch",
  "File is required.": "catalog.products.files.required",
}

const CODE_KEYS: Record<string, string> = {
  "catalog.visibility.filesPresent": "catalog.products.access.filesPresent",
  DUPLICATE_PRODUCT_CODE: "catalog.products.errors.duplicateCode",
  PRODUCT_HAS_ORDERS: "catalog.products.view.errors.hasOrders",
  CUSTOMER_GROUP_IN_USE: "catalog.customerGroups.errors.inUse",
  GROUP_IN_USE: "catalog.customerGroups.errors.inUse",
  FILE_TOO_LARGE: "catalog.products.files.tooLarge",
  FILE_TYPE_NOT_ALLOWED: "catalog.products.files.typeRejected",
  FILE_CONTENT_MISMATCH: "catalog.products.files.contentMismatch",
  resource_unavailable: "catalog.resourcePlanning.errors.resourceUnavailable",
  planning_version_conflict: "catalog.resourcePlanning.errors.planningVersionConflict",
  unsupported_work_window: "catalog.resourcePlanning.errors.unsupportedWorkWindow",
  not_supported_yet: "catalog.resourcePlanning.errors.notSupportedYet",
}

const READINESS_KEYS: Record<string, string> = {
  NAME: "catalog.products.notReady.NAME",
  RESOURCE: "catalog.products.notReady.RESOURCE",
  AUDIENCE: "catalog.products.notReady.AUDIENCE",
  PRICE: "catalog.products.notReady.PRICE",
}

/** Localized names of the open sale requirements, in the order the API sent them. Unknown codes are skipped. */
export function saleMissingLabels(missing: readonly string[]): string[] {
  return missing.flatMap((item) => (READINESS_KEYS[item] != null ? [i18n.t(READINESS_KEYS[item])] : []))
}

/** "Não dá para ativar: falta …" for a 409 PRODUCT_NOT_READY. Null when the payload is another error. */
export function productNotReadyMessage(payload: unknown): string | null {
  if (readApiErrorBody(payload).code !== "PRODUCT_NOT_READY") return null
  const raw = (payload as { missing?: unknown }).missing
  const labels = saleMissingLabels(Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [])
  return labels.length > 0
    ? i18n.t("catalog.products.notReady.message", { items: labels.join(", ") })
    : i18n.t("catalog.products.notReady.generic")
}

export function localizeCatalogApiError(
  payload: unknown,
  fallback: string,
): string {
  const notReady = productNotReadyMessage(payload)
  if (notReady != null) return notReady

  const { code, error } = readApiErrorBody(payload)

  if (code === "planning.outside_working_hours") {
    const violation = (payload as { hoursViolation?: unknown }).hoursViolation
    return `${i18n.t("planning.errors.outside_working_hours")} ${hoursViolationMessage(typeof violation === "string" ? violation : null)}`
  }

  if (isModuleInactiveValue(code) || isModuleInactiveValue(error)) {
    return i18n.t("apiErrors.moduleInactive")
  }

  if (error != null && MESSAGE_KEYS[error] != null) {
    return i18n.t(MESSAGE_KEYS[error])
  }

  if (code != null && CODE_KEYS[code] != null) {
    return i18n.t(CODE_KEYS[code])
  }

  if (error == null || isUnexpectedApiError(error)) {
    return fallback
  }

  return error
}
