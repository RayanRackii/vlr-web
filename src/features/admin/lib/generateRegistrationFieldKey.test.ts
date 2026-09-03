import { describe, expect, it } from "vitest"

import { CORE_REGISTER_FIELD_KEYS } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

import { generateRegistrationFieldKey } from "@/features/admin/lib/generateRegistrationFieldKey"

describe("generateRegistrationFieldKey", () => {
  it("turns a display name into camelCase and skips Portuguese stopwords", () => {
    expect(
      generateRegistrationFieldKey("Data de nascimento", [], CORE_REGISTER_FIELD_KEYS),
    ).toBe("dataNascimento")
  })

  it("strips accents and non-alphanumeric separators", () => {
    expect(
      generateRegistrationFieldKey("  Número-do  cartão  ", [], new Set()),
    ).toBe("numeroCartao")
  })

  it("falls back to campo when the name has no usable tokens", () => {
    expect(generateRegistrationFieldKey("", [], new Set())).toBe("campo")
    expect(generateRegistrationFieldKey("   ---  ", [], new Set())).toBe("campo")
    expect(generateRegistrationFieldKey("de da do", [], new Set())).toBe("campo")
  })

  it("appends 2, 3, … when the key is reserved or already taken", () => {
    expect(
      generateRegistrationFieldKey("Name", [], CORE_REGISTER_FIELD_KEYS),
    ).toBe("name2")
    expect(
      generateRegistrationFieldKey("CPF", ["cpf2"], CORE_REGISTER_FIELD_KEYS),
    ).toBe("cpf3")
    expect(
      generateRegistrationFieldKey("Data de nascimento", ["dataNascimento"], new Set()),
    ).toBe("dataNascimento2")
    expect(
      generateRegistrationFieldKey("campo", ["campo", "campo2"], new Set()),
    ).toBe("campo3")
  })
})
