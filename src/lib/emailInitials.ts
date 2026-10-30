export function getEmailInitials(email: string | null | undefined): string {
  if (!email) {
    return "?"
  }

  const localPart = email.split("@")[0]?.trim() ?? ""

  if (localPart.length === 0) {
    return "?"
  }

  const segments = localPart
    .split(/[._-]+/)
    .filter((segment) => segment.length > 0)

  if (segments.length >= 2) {
    const first = segments[0]?.[0]
    const second = segments[1]?.[0]

    if (first && second) {
      return `${first}${second}`.toUpperCase()
    }
  }

  return localPart.slice(0, 2).toUpperCase()
}
