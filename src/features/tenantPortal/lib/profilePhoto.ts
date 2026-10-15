/**
 * `GET /api/customers/me` returns `photoUrl` and `extraAttributes`.
 * Signup writes the required photo on the tenant field key (FICC: `fotoDePerfil`).
 * The API copies that value into `photoUrl` only for the keys `photo` and `photoUrl`,
 * so the column stays null and the data URL remains on the extra attribute.
 */
const PREFERRED_PHOTO_KEYS = new Set([
  "photo",
  "photourl",
  "foto",
  "fotodeperfil",
])

export function resolveCustomerPhotoUrl(
  photoUrl: string | null | undefined,
  extraAttributes?: Record<string, string | null> | null,
): string | null {
  const column = cleanPhoto(photoUrl)
  if (column) {
    return column
  }

  let dataUrlFallback: string | null = null
  for (const [key, value] of Object.entries(extraAttributes ?? {})) {
    const cleaned = cleanPhoto(value)
    if (!cleaned || !isPhotoValue(cleaned)) {
      continue
    }
    if (PREFERRED_PHOTO_KEYS.has(key.toLowerCase())) {
      return cleaned
    }
    if (dataUrlFallback === null && cleaned.startsWith("data:image/")) {
      dataUrlFallback = cleaned
    }
  }
  return dataUrlFallback
}

function cleanPhoto(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (trimmed.length === 0) {
    return null
  }
  return trimmed
}

function isPhotoValue(value: string): boolean {
  if (value.length < 32) {
    return false
  }
  return value.startsWith("data:image/") || /^https?:\/\//i.test(value)
}
