const MASKED_FALLBACK = "***"

/**
 * Masks an email for display (e.g. rachel@example.com → r***@example.com).
 * Short local parts still mask. Invalid or empty values return a safe fallback.
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim()
  if (trimmed.length === 0) {
    return MASKED_FALLBACK
  }

  const at = trimmed.lastIndexOf("@")
  if (at <= 0 || at === trimmed.length - 1) {
    return MASKED_FALLBACK
  }

  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  if (local.length === 0 || domain.length === 0) {
    return MASKED_FALLBACK
  }

  return `${local[0]}***@${domain}`
}
