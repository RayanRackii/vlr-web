export const CATALOG_RENDERABLE_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

const RENDERABLE_IMAGE_MIME_SET = new Set<string>(CATALOG_RENDERABLE_IMAGE_MIMES)

export type CatalogProductGalleryImage = {
  id: string
  url: string
  fileName: string
}

export type CatalogProductImageCandidate = {
  id: string
  url?: string | null
  fileName: string
  mimeType: string
}

/**
 * First Ready renderable image file (jpeg/png/webp), regardless of visibility and of whether it already has a
 * URL. For staff screens that sign the file themselves when `url` is empty.
 */
export function selectFirstReadyImageFile<T extends CatalogProductImageCandidate & { status: string }>(
  files: readonly T[] | null | undefined,
): T | undefined {
  return files?.find(
    (file) => file.status === "Ready" && RENDERABLE_IMAGE_MIME_SET.has(file.mimeType.trim().toLowerCase()),
  )
}

export function selectCatalogProductImages(
  files: readonly CatalogProductImageCandidate[] | null | undefined,
): CatalogProductGalleryImage[] {
  if (files == null || files.length === 0) {
    return []
  }

  const images: CatalogProductGalleryImage[] = []
  for (const file of files) {
    const mime = file.mimeType.trim().toLowerCase()
    if (!RENDERABLE_IMAGE_MIME_SET.has(mime)) {
      continue
    }

    const url = file.url?.trim() ?? ""
    if (url.length === 0) {
      continue
    }

    images.push({
      id: file.id,
      url,
      fileName: file.fileName,
    })
  }

  return images
}
