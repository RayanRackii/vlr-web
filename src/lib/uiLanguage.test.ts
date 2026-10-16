import { afterEach, describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import {
  parseSupportedLanguage,
  persistLanguage,
  readPersistedLanguage,
  UI_LANGUAGE_STORAGE_KEY,
} from "@/lib/uiLanguage"

describe("ui language persistence", () => {
  afterEach(async () => {
    window.localStorage.removeItem(UI_LANGUAGE_STORAGE_KEY)
    window.localStorage.removeItem("i18nextLng")
    await i18n.changeLanguage("pt-BR")
  })

  it("accepts only the supported codes", () => {
    expect(parseSupportedLanguage("en")).toBe("en")
    expect(parseSupportedLanguage(" es ")).toBe("es")
    expect(parseSupportedLanguage("pt-BR")).toBe("pt-BR")
    expect(parseSupportedLanguage("es-ES")).toBeNull()
    expect(parseSupportedLanguage("en-US")).toBeNull()
    expect(parseSupportedLanguage("fr")).toBeNull()
  })

  it("keeps an explicit choice when the i18next cache is a browser tag or is removed", async () => {
    await i18n.changeLanguage("en")

    expect(window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY)).toBe("en")
    expect(window.localStorage.getItem("i18nextLng")).toBe("en")

    window.localStorage.setItem("i18nextLng", "es-ES")
    expect(readPersistedLanguage()).toBe("en")

    window.localStorage.removeItem("i18nextLng")
    expect(readPersistedLanguage()).toBe("en")
  })

  it("restores the choice after storage is cleared, as on sign-out", async () => {
    await i18n.changeLanguage("en")
    const chosen = readPersistedLanguage()
    window.localStorage.clear()

    expect(readPersistedLanguage()).toBeNull()
    if (chosen !== null) {
      persistLanguage(chosen)
    }

    expect(readPersistedLanguage()).toBe("en")
    expect(window.localStorage.getItem("i18nextLng")).toBe("en")
  })
})
