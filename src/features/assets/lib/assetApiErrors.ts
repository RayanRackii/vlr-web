import i18n from "@/lib/i18n"
import { readApiErrorBody } from "@/lib/apiErrorText"

function conflictMessage(
  status: number | null,
  code: string | null,
  expectedCode: string,
  key: string,
): string | null {
  if (status !== 409 || code !== expectedCode) {
    return null
  }

  return i18n.t(key)
}

export function localizeAssetApiError(
  payload: unknown,
  fallback: string,
  status: number | null = null,
): string {
  const { code } = readApiErrorBody(payload)
  return (
    conflictMessage(
      status,
      code,
      "ASSET_TAG_DUPLICATE",
      "assets.inventory.errors.duplicateTag",
    ) ??
    conflictMessage(
      status,
      code,
      "ASSET_IN_USE",
      "assets.inventory.errors.deleteBlockedByWorkOrders",
    ) ??
    conflictMessage(
      status,
      code,
      "CATEGORY_IN_USE",
      "assets.categories.errors.inUse",
    ) ??
    fallback
  )
}

export function assetDeleteErrorMessage(
  status: number | null,
  payload: unknown,
  fallback: string,
  kind: "asset" | "category",
): string {
  const { code } = readApiErrorBody(payload)

  if (kind === "asset") {
    return (
      conflictMessage(
        status,
        code,
        "ASSET_IN_USE",
        "assets.inventory.errors.deleteBlockedByWorkOrders",
      ) ?? fallback
    )
  }

  return (
    conflictMessage(
      status,
      code,
      "CATEGORY_IN_USE",
      "assets.categories.errors.inUse",
    ) ?? fallback
  )
}

export function assetTagConflictMessage(
  status: number | null,
  payload: unknown,
  fallback: string,
): string {
  const { code } = readApiErrorBody(payload)
  return (
    conflictMessage(
      status,
      code,
      "ASSET_TAG_DUPLICATE",
      "assets.inventory.errors.duplicateTag",
    ) ?? fallback
  )
}
