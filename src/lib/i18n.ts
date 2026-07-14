import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import enCommon from "@/locales/en/common.json"
import esCommon from "@/locales/es/common.json"
import ptBRCommon from "@/locales/pt-BR/common.json"

export const supportedLanguages = ["pt-BR", "en", "es"] as const

export type SupportedLanguage = (typeof supportedLanguages)[number]

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
    supportedLngs: [...supportedLanguages],
    defaultNS: "common",
    ns: ["common"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  })

export default i18n
