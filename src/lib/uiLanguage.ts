export const supportedLanguages = ["pt-BR", "en", "es"] as const

export type SupportedLanguage = (typeof supportedLanguages)[number]

/** Device preference. Logout must not treat this as account data. */
export const UI_LANGUAGE_STORAGE_KEY = "rolvix.uiLanguage"

const I18NEXT_STORAGE_KEY = "i18nextLng"

const supported = new Set<string>(supportedLanguages)

function readStorage(key: string): string | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode can reject storage. The in-memory language still applies.
  }
}

/** Exact pt-BR, en, or es. Browser tags such as es-ES are not a saved choice. */
export function parseSupportedLanguage(
  value: string | null | undefined,
): SupportedLanguage | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!supported.has(trimmed)) {
    return null
  }

  return trimmed as SupportedLanguage
}

/**
 * The language this browser last chose. Our key wins over i18next's cache so a
 * regional browser tag stored there cannot replace an explicit choice.
 */
export function readPersistedLanguage(): SupportedLanguage | null {
  return (
    parseSupportedLanguage(readStorage(UI_LANGUAGE_STORAGE_KEY)) ??
    parseSupportedLanguage(readStorage(I18NEXT_STORAGE_KEY))
  )
}

export function persistLanguage(language: string): void {
  const parsed = parseSupportedLanguage(language)
  if (parsed === null) {
    return
  }

  writeStorage(UI_LANGUAGE_STORAGE_KEY, parsed)
  writeStorage(I18NEXT_STORAGE_KEY, parsed)
}
