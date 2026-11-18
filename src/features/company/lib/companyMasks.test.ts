import { describe, expect, it } from "vitest"

import { maskCepInput, maskTaxIdInput } from "@/features/company/lib/companyMasks"

describe("companyMasks", () => {
  it("masks a CPF progressively and a CNPJ once it passes 11 digits", () => {
    expect(maskTaxIdInput("")).toBe("")
    expect(maskTaxIdInput("123")).toBe("123")
    expect(maskTaxIdInput("1234")).toBe("123.4")
    expect(maskTaxIdInput("12345678901")).toBe("123.456.789-01")
    expect(maskTaxIdInput("123456789012")).toBe("12.345.678/9012-")
    expect(maskTaxIdInput("12345678000199")).toBe("12.345.678/0001-99")
    expect(maskTaxIdInput("12.345.678/0001-99999")).toBe("12.345.678/0001-99")
  })

  it("masks the CEP and drops non-digits", () => {
    expect(maskCepInput("01310")).toBe("01310")
    expect(maskCepInput("01310100")).toBe("01310-100")
    expect(maskCepInput("01310-100x9")).toBe("01310-100")
  })
})
