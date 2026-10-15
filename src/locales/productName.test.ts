import { describe, expect, it } from "vitest"

import en from "@/locales/en/common.json"
import es from "@/locales/es/common.json"
import ptBR from "@/locales/pt-BR/common.json"

describe("product name", () => {
  it("uses Rolvix as the app name in every locale", () => {
    expect(ptBR.app.name).toBe("Rolvix")
    expect(en.app.name).toBe("Rolvix")
    expect(es.app.name).toBe("Rolvix")
  })

  it("names the Super-Admin module section after Rolvix", () => {
    expect(ptBR.admin.edit.sections.modules).toBe("Módulos Rolvix")
    expect(en.admin.edit.sections.modules).toBe("Rolvix Modules")
    expect(es.admin.edit.sections.modules).toBe("Módulos Rolvix")
  })
})
