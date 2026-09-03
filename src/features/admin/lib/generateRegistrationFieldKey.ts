import { CORE_REGISTER_FIELD_KEYS } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

const STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "para",
  "por",
  "com",
  "a",
  "o",
])

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "")
}

function tokenize(normalized: string): string[] {
  return normalized.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 0)
}

function toCamelCase(displayName: string): string {
  const tokens = tokenize(stripAccents(displayName.trim())).filter(
    (token) => !STOPWORDS.has(token.toLowerCase()),
  )

  if (tokens.length === 0) {
    return ""
  }

  return tokens
    .map((token, index) => {
      const lower = token.toLowerCase()
      if (index === 0) {
        return lower
      }
      return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`
    })
    .join("")
}

export function generateRegistrationFieldKey(
  displayName: string,
  existingKeys: readonly string[],
  reservedKeys: ReadonlySet<string> = CORE_REGISTER_FIELD_KEYS,
): string {
  const taken = new Set(
    [...existingKeys, ...reservedKeys].map((key) => key.toLowerCase()),
  )
  const base = toCamelCase(displayName) || "campo"

  if (!taken.has(base.toLowerCase())) {
    return base
  }

  let suffix = 2
  while (taken.has(`${base}${suffix}`.toLowerCase())) {
    suffix += 1
  }

  return `${base}${suffix}`
}
