import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import enCommon from "@/locales/en/common.json"
import esCommon from "@/locales/es/common.json"
import ptBRCommon from "@/locales/pt-BR/common.json"

export const supportedLanguages = ["pt-BR", "en", "es"] as const

export type SupportedLanguage = (typeof supportedLanguages)[number]

const cachedLng =
  typeof window !== "undefined"
    ? window.localStorage.getItem("i18nextLng")
    : null

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
    // Honor a saved choice; otherwise lock first paint to pt-BR (no browser EN/ES).
    ...(cachedLng ? {} : { lng: "pt-BR" }),
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
      lookupLocalStorage: "i18nextLng",
    },
  })

export default i18n
