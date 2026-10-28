/** Customer labels can be names or email fallbacks from the saved session. */
export function customerDisplayName(label: string | null | undefined): string {
  const trimmed = label?.trim() ?? ""
  if (!trimmed.includes("@")) return trimmed
  return trimmed.split("@")[0].split(/[._-]+/).filter(Boolean).join(" ")
}

export function customerDisplayInitials(displayName: string): string {
  const words = displayName.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return displayName.slice(0, 2).toUpperCase() || "?"
}
