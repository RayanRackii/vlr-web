export const WORK_ORDER_IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** Refresh a signed preview shortly before the storage TTL ends. */
export const SIGNED_URL_REFRESH_LEAD_MS = 15_000

const GUID_D =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GUID_N = /^[0-9a-f]{32}$/i
const GUID_B =
  /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i
const GUID_P =
  /^\([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)$/i

export type WorkOrderImageRejection = "tooLarge" | "typeNotAllowed"

type ImageKind = "jpeg" | "png" | "webp"
type MimeClass = ImageKind | "unknown" | "rejected"

export function isWorkOrderImageFileId(
  value: string | null | undefined,
): boolean {
  return canonicalWorkOrderImageFileId(value) != null
}

/** Format `D`, lowercase, so the file route receives a guid. */
export function canonicalWorkOrderImageFileId(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null
  }

  const trimmed = value.trim()
  if (
    trimmed.length === 0 ||
    trimmed.startsWith("data:") ||
    !(
      GUID_D.test(trimmed) ||
      GUID_N.test(trimmed) ||
      GUID_B.test(trimmed) ||
      GUID_P.test(trimmed)
    )
  ) {
    return null
  }

  const hex = trimmed.replace(/[^0-9a-f]/gi, "").toLowerCase()
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function workOrderImageRejection(
  file: Pick<File, "name" | "size" | "type">,
): WorkOrderImageRejection | null {
  if (file.size <= 0 || file.size > WORK_ORDER_IMAGE_MAX_BYTES) {
    return "tooLarge"
  }

  if (resolveImageKind(file.name, file.type) == null) {
    return "typeNotAllowed"
  }

  return null
}

/**
 * Milliseconds until a signed URL should be requested again.
 * `0` means it is already inside the refresh window.
 * `null` means the URL does not advertise an expiry.
 */
export function signedUrlRefreshDelayMs(
  url: string,
  now = Date.now(),
): number | null {
  const expiresAt = signedUrlExpiresAtMs(url)
  if (expiresAt == null) {
    return null
  }

  const remaining = expiresAt - now
  if (remaining <= SIGNED_URL_REFRESH_LEAD_MS) {
    return 0
  }

  return remaining - SIGNED_URL_REFRESH_LEAD_MS
}

export function signedUrlExpiresAtMs(url: string): number | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const exp = unixSeconds(parsed.searchParams.get("exp"))
  if (exp != null) {
    return exp
  }

  const amzDate = parsed.searchParams.get("X-Amz-Date")
  const amzExpires = parsed.searchParams.get("X-Amz-Expires")
  if (amzDate != null && amzExpires != null && /^\d+$/.test(amzExpires)) {
    const start = amzDateToMs(amzDate)
    const seconds = Number(amzExpires)
    if (start != null && Number.isFinite(seconds)) {
      return start + seconds * 1000
    }
  }

  const token = parsed.searchParams.get("token")
  if (token != null) {
    return jwtExpMs(token)
  }

  return null
}

function resolveImageKind(name: string, type: string): ImageKind | null {
  const mime = classifyMime(canonicalMime(type))
  const extension = classifyExtension(extensionOf(name))

  if (mime === "rejected" || extension === "rejected") {
    return null
  }

  if (
    mime !== "unknown" &&
    extension !== "none" &&
    mime !== extension
  ) {
    return null
  }

  if (mime !== "unknown") {
    return mime
  }

  return extension === "none" ? null : extension
}

function canonicalMime(type: string): string {
  return type.split(";", 1)[0]?.trim().toLowerCase() ?? ""
}

function classifyMime(mime: string): MimeClass {
  if (mime.length === 0 || mime === "application/octet-stream") {
    return "unknown"
  }

  if (mime === "image/jpeg" || mime === "image/jpg" || mime === "image/pjpeg") {
    return "jpeg"
  }

  if (mime === "image/png") {
    return "png"
  }

  if (mime === "image/webp") {
    return "webp"
  }

  return "rejected"
}

function classifyExtension(extension: string): ImageKind | "none" | "rejected" {
  if (extension.length === 0) {
    return "none"
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "jpeg"
  }

  if (extension === ".png") {
    return "png"
  }

  if (extension === ".webp") {
    return "webp"
  }

  return "rejected"
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  if (dot < 0 || dot === fileName.length - 1) {
    return ""
  }

  return fileName.slice(dot).toLowerCase()
}

function unixSeconds(value: string | null): number | null {
  if (value == null || !/^\d+$/.test(value)) {
    return null
  }

  const seconds = Number(value)
  if (!Number.isFinite(seconds)) {
    return null
  }

  return seconds * 1000
}

function amzDateToMs(value: string): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value)
  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute, second] = match
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
}

function jwtExpMs(token: string): number | null {
  const segment = token.split(".")[1]
  if (segment == null || segment.length === 0) {
    return null
  }

  try {
    const json = atob(segment.replace(/-/g, "+").replace(/_/g, "/"))
    const payload: unknown = JSON.parse(json)
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("exp" in payload) ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp)
    ) {
      return null
    }

    return payload.exp * 1000
  } catch {
    return null
  }
}
