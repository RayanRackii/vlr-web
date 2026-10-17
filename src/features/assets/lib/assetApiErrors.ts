import i18n from "@/lib/i18n"
import {
  isUnexpectedApiError,
  readApiErrorBody,
} from "@/lib/apiErrorText"

const CODE_KEYS: Record<string, string> = {
  ASSET_TAG_DUPLICATE: "assets.inventory.errors.duplicateTag",
  ASSET_IN_USE: "assets.inventory.errors.deleteBlockedByWorkOrders",
  CATEGORY_IN_USE: "assets.categories.errors.inUse",
}

export function localizeAssetApiError(
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

  if (/tags already exist/i.test(error) || /tag already exists/i.test(error)) {
    return i18n.t("assets.inventory.errors.duplicateTag")
  }

  if (/cannot permanently delete an asset category/i.test(error)) {
    return i18n.t("assets.categories.errors.inUse")
  }

  if (
    /work orders?/i.test(error) &&
    /(delete|cannot|referenced|in use)/i.test(error)
  ) {
    return i18n.t("assets.inventory.errors.deleteBlockedByWorkOrders")
  }

  if (isUnexpectedApiError(error)) {
    return fallback
  }

  return error
}

export function assetDeleteErrorMessage(
  payload: unknown,
  fallback: string,
  kind: "asset" | "category",
): string {
  const { code, error } = readApiErrorBody(payload)
  const localized = localizeAssetApiError(payload, fallback)

  if (
    kind === "asset" &&
    (code === "ASSET_IN_USE" || isUnexpectedApiError(error))
  ) {
    return i18n.t("assets.inventory.errors.deleteBlockedByWorkOrders")
  }

  if (
    kind === "category" &&
    (code === "CATEGORY_IN_USE" ||
      isUnexpectedApiError(error) ||
      /cannot permanently delete an asset category/i.test(error ?? ""))
  ) {
    return i18n.t("assets.categories.errors.inUse")
  }

  return localized
}

export function assetTagConflictMessage(
  payload: unknown,
  fallback: string,
): string {
  const { code, error } = readApiErrorBody(payload)
  if (code === "ASSET_TAG_DUPLICATE" || isUnexpectedApiError(error)) {
    return i18n.t("assets.inventory.errors.duplicateTag")
  }

  return localizeAssetApiError(payload, fallback)
}
