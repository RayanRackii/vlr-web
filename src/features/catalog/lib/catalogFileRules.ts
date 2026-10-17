import type { CatalogFileVisibility } from "@/features/catalog/schemas/catalogSchemas"

export const CUSTOMER_VISIBLE_MAX_BYTES = 5 * 1024 * 1024
export const INTERNAL_MAX_BYTES = 25 * 1024 * 1024

const CUSTOMER_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"])
const INTERNAL_EXTENSIONS = new Set([".pdf", ".stl", ".step", ".stp", ".dxf"])

export type CatalogFileRejection =
  | "tooLargeCustomer"
  | "tooLargeInternal"
  | "typeCustomer"
  | "typeInternal"
  | "extensionRequired"

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  if (dot < 0 || dot === fileName.length - 1) {
    return ""
  }
  return fileName.slice(dot).toLowerCase()
}

export function catalogFileRejection(
  file: Pick<File, "name" | "size">,
  visibility: CatalogFileVisibility,
): CatalogFileRejection | null {
  const extension = extensionOf(file.name)
  if (extension.length === 0) {
    return "extensionRequired"
  }

  if (visibility === "CustomerVisible") {
    if (file.size > CUSTOMER_VISIBLE_MAX_BYTES) {
      return "tooLargeCustomer"
    }
    if (!CUSTOMER_EXTENSIONS.has(extension)) {
      return "typeCustomer"
    }
    return null
  }

  if (file.size > INTERNAL_MAX_BYTES) {
    return "tooLargeInternal"
  }
  if (!INTERNAL_EXTENSIONS.has(extension)) {
    return "typeInternal"
  }
  return null
}
