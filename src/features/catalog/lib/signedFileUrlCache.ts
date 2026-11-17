import { getCatalogProductFileUrl } from "@/features/catalog/services/catalogService"

/** The API signs for 120 s (CatalogFileUrls.SignedUrlTtl); keep the cache a bit shorter. */
export const SIGNED_URL_CACHE_TTL_MS = 90_000

const cache = new Map<string, { url: string; expiresAt: number }>()
const inFlight = new Map<string, Promise<string>>()

/** Signed URL for a product file: cached per file id, with at most one concurrent request per file id. */
export function getSignedProductFileUrl(productId: string, fileId: string): Promise<string> {
  const hit = cache.get(fileId)
  if (hit != null && hit.expiresAt > Date.now()) return Promise.resolve(hit.url)

  const pending = inFlight.get(fileId)
  if (pending != null) return pending

  const request = getCatalogProductFileUrl(productId, fileId)
    .then(({ url }) => {
      cache.set(fileId, { url, expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS })
      return url
    })
    .finally(() => inFlight.delete(fileId))
  inFlight.set(fileId, request)
  return request
}

/** Test helper. */
export function clearSignedProductFileUrlCache() {
  cache.clear()
  inFlight.clear()
}
