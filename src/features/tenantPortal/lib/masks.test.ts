import { describe, expect, it, vi } from "vitest"

import {
  maskBrazilianPhone,
  maskCnpj,
  maskCpf,
  maskCustomerDocument,
  maskPhoneInput,
} from "@/features/tenantPortal/lib/masks"

describe("maskPhoneInput", () => {
  it("formats a Brazilian mobile number as it grows", () => {
    expect(maskPhoneInput("")).toBe("")
    expect(maskPhoneInput("11")).toBe("(11")
    expect(maskPhoneInput("119")).toBe("(11) 9")
    expect(maskPhoneInput("1198888")).toBe("(11) 9888-8")
    expect(maskPhoneInput("11988880001")).toBe("(11) 98888-0001")
    expect(maskPhoneInput("(11) 98888-0001")).toBe("(11) 98888-0001")
  })

  it("formats a 10-digit landline", () => {
    expect(maskPhoneInput("1133334444")).toBe("(11) 3333-4444")
  })

  it("keeps DDD 55 as a national number until a country code is present", () => {
    expect(maskPhoneInput("55999999999")).toBe("(55) 99999-9999")
  })

  it("formats +55 and a long pasted 55 as E.164", () => {
    expect(maskPhoneInput("+55 45 99999-9999")).toBe("+55 (45) 99999-9999")
    expect(maskPhoneInput("+5511912345678")).toBe("+55 (11) 91234-5678")
    expect(maskPhoneInput("5511912345678")).toBe("+55 (11) 91234-5678")
    expect(maskPhoneInput("005511912345678")).toBe("+55 (11) 91234-5678")
  })

  it("groups a non-Brazilian E.164 number", () => {
    expect(maskPhoneInput("+1 555 0100")).toBe("+155 501 00")
    expect(maskPhoneInput("+")).toBe("+")
  })

  it("does not log the typed number", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    maskPhoneInput("+55 11 91234-5678")
    maskCpf("12345678901")
    maskBrazilianPhone("11988880001")

    expect(log).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalled()
    expect(debug).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    log.mockRestore()
    info.mockRestore()
    debug.mockRestore()
    warn.mockRestore()
  })
})

describe("profile privacy masks", () => {
  it("masks CPF as ***.456.789-**", () => {
    expect(maskCpf("12345678901")).toBe("***.456.789-**")
    expect(maskCpf("123.456.789-01")).toBe("***.456.789-**")
    expect(maskCpf("52998224725")).toBe("***.982.247-**")
  })

  it("masks CNPJ without revealing the full number", () => {
    expect(maskCnpj("12.345.678/0001-95")).toBe("**.345.678/****-**")
  })

  it("masks a stored Brazilian phone and hides unexpected lengths", () => {
    expect(maskBrazilianPhone("11988880001")).toBe("(11) *****-0001")
    expect(maskBrazilianPhone("+55 (11) 98888-0001")).toBe("(11) *****-0001")
    expect(maskBrazilianPhone("1133334444")).toBe("(11) ****-4444")
    expect(maskBrazilianPhone("12345")).toBe("***45")
    expect(maskBrazilianPhone(null)).toBe("")
    expect(maskCpf("123")).toBe("*23")
  })

  it("selects CPF or CNPJ from the profile document", () => {
    expect(maskCustomerDocument("Individual", "52998224725", null)).toBe(
      "***.982.247-**",
    )
    expect(maskCustomerDocument("Company", "12345678000195", null)).toBe(
      "**.345.678/****-**",
    )
    expect(maskCustomerDocument("Individual", null, null)).toBeNull()
  })
})
