import { isResourceWizardStep } from "@/features/rentals/components/resourceWizard/wizardSteps"

const MAX_DECODES = 5
const ENCODED_SEPARATOR = /%(?:2e|2f|5c)/i

function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code <= 31 || code === 127) {
      return true
    }
  }
  return false
}

/** Reject encoded ".", "/", or "\" before they can survive one decode and become traversal. */
function hasEncodedSeparator(value: string): boolean {
  return ENCODED_SEPARATOR.test(value)
}

function fullyDecode(value: string): string | null {
  let current = value.trim()
  if (current.length === 0) {
    return null
  }
  for (let attempt = 0; attempt < MAX_DECODES; attempt += 1) {
    if (hasEncodedSeparator(current)) {
      return null
    }
    if (!current.includes("%")) {
      return current
    }
    try {
      const next = decodeURIComponent(current)
      if (next === current) {
        return current
      }
      current = next
    } catch {
      return null
    }
  }
  return hasEncodedSeparator(current) || current.includes("%") ? null : current
}

function isResourceSegment(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value)
}

function isAllowedResourcePath(path: string, query: string): boolean {
  const parts = path.split("/")
  if (parts[0] !== "" || parts[1] !== "configuracoes" || parts[2] !== "recursos") {
    return false
  }
  if (parts.length === 3) {
    return query.length === 0
  }
  const id = parts[3] ?? ""
  if (!isResourceSegment(id)) {
    return false
  }
  if (parts.length === 4) {
    return query.length === 0
  }
  if (parts.length !== 5 || parts[4] !== "assistente") {
    return false
  }
  if (query.length === 0) {
    return true
  }
  const params = new URLSearchParams(query)
  const keys = [...params.keys()]
  return keys.length === 1 && keys[0] === "passo" && isResourceWizardStep(params.get("passo"))
}

/**
 * Same-origin return path for the resource wizard.
 * Only `/configuracoes/recursos`, the resource editor, and the wizard survive.
 */
export function safeStaffReturnTo(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }
  const decoded = fullyDecode(value)
  if (decoded == null) {
    return null
  }
  if (
    !decoded.startsWith("/configuracoes/recursos") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    decoded.includes("://") ||
    decoded.includes("..") ||
    decoded.includes("#") ||
    hasControlCharacter(decoded)
  ) {
    return null
  }
  const queryIndex = decoded.indexOf("?")
  if (queryIndex >= 0 && decoded.indexOf("?", queryIndex + 1) !== -1) {
    return null
  }
  const path = queryIndex >= 0 ? decoded.slice(0, queryIndex) : decoded
  const query = queryIndex >= 0 ? decoded.slice(queryIndex + 1) : ""
  if (!isAllowedResourcePath(path, query)) {
    return null
  }
  return decoded
}
