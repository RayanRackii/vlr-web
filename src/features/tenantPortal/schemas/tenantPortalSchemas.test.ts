import { describe, expect, it } from "vitest"

import { buildCustomerRegisterSchema } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

const CORE = {
  name: "Ana Silva",
  email: "ana@club.test",
  password: "password1",
  confirmPassword: "password1",
  phone: "11988880001",
}

describe("buildCustomerRegisterSchema PF/PJ", () => {
  const schema = buildCustomerRegisterSchema([], "mismatch", {
    invalidCpf: "Invalid CPF",
    invalidCnpj: "Invalid CNPJ",
  })

  it("accepts Individual with a valid CPF", () => {
    const parsed = schema.safeParse({
      ...CORE,
      customerType: "Individual",
      document: "529.982.247-25",
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects Individual with an invalid CPF", () => {
    const parsed = schema.safeParse({
      ...CORE,
      customerType: "Individual",
      document: "11111111111",
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path[0] === "document")).toBe(
        true,
      )
    }
  })

  it("accepts Company with a valid CNPJ", () => {
    const parsed = schema.safeParse({
      ...CORE,
      customerType: "Company",
      document: "11.222.333/0001-81",
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects Company when the document is a CPF", () => {
    const parsed = schema.safeParse({
      ...CORE,
      customerType: "Company",
      document: "52998224725",
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path[0] === "document")).toBe(
        true,
      )
    }
  })
})
