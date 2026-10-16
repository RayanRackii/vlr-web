import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import enCommon from "@/locales/en/common.json"
import esCommon from "@/locales/es/common.json"
import ptBRCommon from "@/locales/pt-BR/common.json"
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

i18n.on("languageChanged", (language) => {
  syncDocumentLanguage(language)
  persistLanguage(language)
})

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": { common: ptBRCommon },
      en: { common: enCommon },
      es: { common: esCommon },
    },
    fallbackLng: "pt-BR",
    // Honor an explicit choice. Otherwise lock first paint to pt-BR.
    // Do not let a regional browser tag (es-ES, en-US) replace that.
    lng: initialLanguage ?? "pt-BR",
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
  .then(() => {
    syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)
  })

export default i18n
