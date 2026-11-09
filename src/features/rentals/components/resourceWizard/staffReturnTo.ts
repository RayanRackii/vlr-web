function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code <= 31 || code === 127) {
      return true
    }
  }
  return false
}

/** Staff return path. Only same-app configuration routes survive. */
export function safeStaffReturnTo(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }
  let decoded = value.trim()
  if (decoded.length === 0) {
    return null
  }
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    return null
  }
  if (!decoded.startsWith("/configuracoes/")) {
    return null
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || decoded.includes("://")) {
    return null
  }
  if (decoded.includes("..") || hasControlCharacter(decoded)) {
    return null
  }
  const queryIndex = decoded.indexOf("?")
  if (queryIndex >= 0 && decoded.indexOf("?", queryIndex + 1) !== -1) {
    return null
  }
  if (decoded.includes("#")) {
    return null
  }
  return decoded
}
