import { createInstance } from "i18next"
import { describe, expect, it } from "vitest"

import enCommon from "@/locales/en/common.json"
import { defaultCommonBundle, ensureLanguageBundle } from "@/lib/localeBundles"

async function freshInstance() {
  const instance = createInstance()
  await instance.init({
    resources: { "pt-BR": { common: defaultCommonBundle } },
    lng: "pt-BR",
    fallbackLng: "pt-BR",
    defaultNS: "common",
    ns: ["common"],
    interpolation: { escapeValue: false },
  })
  return instance
}

describe("ensureLanguageBundle", () => {
  it("does not register en before it is requested, then loads it once and translates", async () => {
    const instance = await freshInstance()
    expect(instance.hasResourceBundle("en", "common")).toBe(false)

    const first = ensureLanguageBundle(instance, "en")
    const second = ensureLanguageBundle(instance, "en")
    await Promise.all([first, second])
    expect(instance.hasResourceBundle("en", "common")).toBe(true)

    const registered = instance.getResourceBundle("en", "common")
    await ensureLanguageBundle(instance, "en")
    expect(instance.getResourceBundle("en", "common")).toBe(registered)

    const ptText = instance.t("staffAgenda.view")
    await instance.changeLanguage("en")
    expect(instance.language).toBe("en")
    expect(instance.t("staffAgenda.view")).toBe(enCommon.staffAgenda.view)
    expect(instance.t("staffAgenda.view")).not.toBe(ptText)
  })

  it("loads es and keeps pt-BR as a no-op", async () => {
    const instance = await freshInstance()
    await ensureLanguageBundle(instance, "pt-BR")
    await ensureLanguageBundle(instance, "es")
    expect(instance.hasResourceBundle("es", "common")).toBe(true)
  })
})
