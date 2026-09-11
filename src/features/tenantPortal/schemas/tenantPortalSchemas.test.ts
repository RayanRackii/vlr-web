import { describe, expect, it } from "vitest"

import { maskEmail } from "@/features/tenantPortal/lib/maskEmail"
import {
  buildCustomerRegisterSchema,
  registerResponseSchema,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"

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

describe("registerResponseSchema", () => {
  const customerId = "11111111-1111-4111-8111-111111111111"

  it("requires requiresEmailVerification", () => {
    const parsed = registerResponseSchema.safeParse({
      customerId,
      verificationStarted: true,
    })
    expect(parsed.success).toBe(false)
  })

  it("accepts a register response without requiresPhoneVerification", () => {
    const parsed = registerResponseSchema.safeParse({
      customerId,
      requiresEmailVerification: true,
      verificationStarted: false,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.requiresEmailVerification).toBe(true)
      expect(parsed.data.verificationStarted).toBe(false)
      expect(parsed.data.requiresPhoneVerification).toBeUndefined()
    }
  })

  it("accepts a register response with the phone compat alias", () => {
    const parsed = registerResponseSchema.safeParse({
      customerId,
      requiresEmailVerification: true,
      requiresPhoneVerification: true,
      verificationStarted: true,
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects a register response without verificationStarted", () => {
    const parsed = registerResponseSchema.safeParse({
      customerId,
      requiresEmailVerification: true,
    })
    expect(parsed.success).toBe(false)
  })
})

describe("maskEmail", () => {
  it("masks the local part after the first character", () => {
    expect(maskEmail("rachel@example.com")).toBe("r***@example.com")
  })

  it("still masks a short local part", () => {
    expect(maskEmail("a@example.com")).toBe("a***@example.com")
    expect(maskEmail("ab@club.test")).toBe("a***@club.test")
  })

  it("returns a safe fallback for empty or invalid values", () => {
    expect(maskEmail("")).toBe("***")
    expect(maskEmail("   ")).toBe("***")
    expect(maskEmail("not-an-email")).toBe("***")
    expect(maskEmail("@example.com")).toBe("***")
    expect(maskEmail("rachel@")).toBe("***")
  })
})
