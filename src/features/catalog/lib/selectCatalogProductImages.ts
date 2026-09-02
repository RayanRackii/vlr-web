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
