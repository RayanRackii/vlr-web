export const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Accepts "8", "830", "0830", "8:30", "08:30" and returns "HH:mm", or null when invalid. */
export function normalizeTime24(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  let hours: string
  let minutes: string
  if (trimmed.includes(":")) {
    const segments = trimmed.split(":")
    if (
      segments.length !== 2 ||
      !/^\d{1,2}$/.test(segments[0]) ||
      !/^\d{1,2}$/.test(segments[1])
    ) {
      return null
    }
    ;[hours, minutes] = segments
  } else if (/^\d{1,2}$/.test(trimmed)) {
    hours = trimmed
    minutes = "00"
  } else if (/^\d{3,4}$/.test(trimmed)) {
    hours = trimmed.slice(0, trimmed.length - 2)
    minutes = trimmed.slice(-2)
  } else {
    return null
  }
  const value = `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`
  return HH_MM.test(value) ? value : null
}

