import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import {
  DEFAULT_LANGUAGE,
  defaultCommonBundle,
  ensureLanguageBundle,
} from "@/lib/localeBundles"
import {
  persistLanguage,
  readPersistedLanguage,
  supportedLanguages,
  type SupportedLanguage,
} from "@/lib/uiLanguage"

export { supportedLanguages }
export type { SupportedLanguage }

/** Endonyms. The picker must not translate these into the active UI language. */
export const languageNativeNames: Record<SupportedLanguage, string> = {
  "pt-BR": "Português",
  en: "English",
  es: "Español",
}

function syncDocumentLanguage(language: string): void {
  if (typeof document === "undefined") {
    return
  }
  document.documentElement.lang = language
}

const initialLanguage = readPersistedLanguage()

/** Downloads the language bundle first, then switches. Use instead of i18n.changeLanguage. */
export async function changeLanguage(language: string): Promise<void> {
  await ensureLanguageBundle(i18n, language)
  await i18n.changeLanguage(language)
}

// Do not overwrite the saved choice while the startup restore is still downloading it.
let restoringSavedLanguage = false

i18n.on("languageChanged", (language) => {
  syncDocumentLanguage(language)
  if (!restoringSavedLanguage) {
    persistLanguage(language)
  }
})

restoringSavedLanguage =
  !!initialLanguage && initialLanguage !== DEFAULT_LANGUAGE

const initPromise = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": { common: defaultCommonBundle },
    },
    fallbackLng: "pt-BR",
    // Honor an explicit choice. Otherwise lock first paint to pt-BR.
    // Do not let a regional browser tag (es-ES, en-US) replace that.
    lng: DEFAULT_LANGUAGE,
    supportedLngs: [...supportedLanguages],
    // Do NOT set nonExplicitSupportedLngs: true — i18next 26 breaks pt-BR lookup when
    // only regional codes (pt-BR) are listed (returns raw keys).
    defaultNS: "common",
    ns: ["common"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "rolvix.uiLanguage",
    },
  })
  .then(async () => {
    // Non-default saved language: download its bundle, then switch (no raw keys).
    if (initialLanguage && initialLanguage !== DEFAULT_LANGUAGE) {
      try {
        await changeLanguage(initialLanguage)
      } catch {
        // Offline/chunk error: stay on the default language, keep the saved choice.
      }
    }
    restoringSavedLanguage = false
    syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)
  })

/** Resolves once i18n is initialised and the saved language (if any) is active. */
export const i18nReady: Promise<void> = initPromise.then(() => undefined)

export default i18n
