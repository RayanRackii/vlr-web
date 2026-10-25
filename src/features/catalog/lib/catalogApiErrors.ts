import i18n from "@/lib/i18n"
import {
  isModuleInactiveValue,
  isUnexpectedApiError,
  readApiErrorBody,
} from "@/lib/apiErrorText"

const MESSAGE_KEYS: Record<string, string> = {
  "A product with this code already exists.":
    "catalog.products.errors.duplicateCode",
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
  DUPLICATE_PRODUCT_CODE: "catalog.products.errors.duplicateCode",
  FILE_TOO_LARGE: "catalog.products.files.tooLarge",
  FILE_TYPE_NOT_ALLOWED: "catalog.products.files.typeRejected",
  FILE_CONTENT_MISMATCH: "catalog.products.files.contentMismatch",
}

export function localizeCatalogApiError(
  payload: unknown,
  fallback: string,
): string {
  const { code, error } = readApiErrorBody(payload)

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
