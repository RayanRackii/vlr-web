import { describe, expect, it } from "vitest"

import { maskEmail } from "@/features/tenantPortal/lib/maskEmail"
import {
  buildCustomerLoginSchema,
  buildCustomerRegisterSchema,
  buildVerifyEmailSchema,
  isValidBrazilianPhoneDigits,
  normalizeBrazilianPhoneDigits,
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

describe("normalizeBrazilianPhoneDigits", () => {
  it("strips +55 from a mobile autofill value", () => {
    expect(normalizeBrazilianPhoneDigits("+55 45 99999-9999")).toBe("45999999999")
    expect(isValidBrazilianPhoneDigits("+55 45 99999-9999")).toBe(true)
  })

  it("strips +55 from a landline", () => {
    expect(normalizeBrazilianPhoneDigits("+55 45 3333-4444")).toBe("4533334444")
    expect(isValidBrazilianPhoneDigits("+55 45 3333-4444")).toBe(true)
  })

  it("keeps national 10-digit and 11-digit numbers", () => {
    expect(normalizeBrazilianPhoneDigits("4533334444")).toBe("4533334444")
    expect(normalizeBrazilianPhoneDigits("45999999999")).toBe("45999999999")
    expect(isValidBrazilianPhoneDigits("4533334444")).toBe(true)
    expect(isValidBrazilianPhoneDigits("45999999999")).toBe(true)
  })

  it("accepts formatted national input", () => {
    expect(normalizeBrazilianPhoneDigits("(45) 99999-9999")).toBe("45999999999")
    expect(normalizeBrazilianPhoneDigits("45 99999-9999")).toBe("45999999999")
    expect(normalizeBrazilianPhoneDigits("5545999999999")).toBe("45999999999")
  })

  it("does not strip DDD 55 from an 11-digit national mobile", () => {
    expect(normalizeBrazilianPhoneDigits("55999999999")).toBe("55999999999")
    expect(isValidBrazilianPhoneDigits("55999999999")).toBe(true)
  })

  it("rejects short and overlong values without truncating", () => {
    expect(normalizeBrazilianPhoneDigits("459999999")).toBe("459999999")
    expect(isValidBrazilianPhoneDigits("459999999")).toBe(false)
    expect(normalizeBrazilianPhoneDigits("55459999999999")).toBe("459999999999")
    expect(isValidBrazilianPhoneDigits("55459999999999")).toBe(false)
    expect(normalizeBrazilianPhoneDigits("123456789012")).toBe("123456789012")
    expect(isValidBrazilianPhoneDigits("123456789012")).toBe(false)
  })
})

describe("buildCustomerRegisterSchema phone", () => {
  const schema = buildCustomerRegisterSchema([], "mismatch", {
    invalidCpf: "Invalid CPF",
    invalidCnpj: "Invalid CNPJ",
  })

  function parsePhone(phone: string) {
    return schema.safeParse({
      ...CORE,
      customerType: "Individual",
      document: "529.982.247-25",
      phone,
    })
  }

  it("accepts +55 mobile, landline, and formatted national phones", () => {
    expect(parsePhone("+55 45 99999-9999").success).toBe(true)
    expect(parsePhone("+55 45 3333-4444").success).toBe(true)
    expect(parsePhone("(45) 99999-9999").success).toBe(true)
    expect(parsePhone("45 99999-9999").success).toBe(true)
    expect(parsePhone("4533334444").success).toBe(true)
    expect(parsePhone("45999999999").success).toBe(true)
  })

  it("rejects invalid short and long phones", () => {
    expect(parsePhone("459999999").success).toBe(false)
    expect(parsePhone("55459999999999").success).toBe(false)
    expect(parsePhone("123456789012").success).toBe(false)
  })
})

const ENGLISH_ZOD_DEFAULTS = /Invalid input|Invalid email|Invalid phone|Invalid CEP/i

describe("B2C Portuguese validation messages", () => {
  const loginSchema = buildCustomerLoginSchema({
    emailInvalid: "E-mail inválido.",
    passwordRequired: "Informe sua senha.",
  })
  const verifySchema = buildVerifyEmailSchema({
    emailInvalid: "E-mail inválido.",
    codeInvalid: "Código inválido.",
  })
  const registerSchema = buildCustomerRegisterSchema(
    [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        fieldKey: "fotoDePerfil",
        label: "Foto de perfil",
        fieldType: "photo",
        isRequired: true,
        sortOrder: 1,
        options: null,
      },
    ],
    "As senhas precisam ser iguais.",
    { invalidCpf: "CPF inválido.", invalidCnpj: "CNPJ inválido." },
    {
      emailInvalid: "E-mail inválido.",
      passwordMin: "A senha deve ter no mínimo 8 caracteres.",
      phoneInvalid: "Informe um celular válido.",
      photoRequired: "Envie uma foto de perfil.",
    },
  )

  it("uses Portuguese copy for invalid login email and empty password", () => {
    const parsed = loginSchema.safeParse({ email: "not-an-email", password: "" })
    expect(parsed.success).toBe(false)
    if (parsed.success) {
      return
    }
    const messages = parsed.error.issues.map((issue) => issue.message)
    expect(messages).toContain("E-mail inválido.")
    expect(messages).toContain("Informe sua senha.")
    expect(messages.some((message) => ENGLISH_ZOD_DEFAULTS.test(message))).toBe(
      false,
    )
  })

  it("uses Portuguese copy for an invalid verification code", () => {
    const parsed = verifySchema.safeParse({
      email: "ana@club.test",
      code: "12ab",
    })
    expect(parsed.success).toBe(false)
    if (parsed.success) {
      return
    }
    expect(parsed.error.issues.map((issue) => issue.message)).toContain(
      "Código inválido.",
    )
  })

  it("does not leak Zod defaults from empty register or required photo", () => {
    const parsed = registerSchema.safeParse({
      name: "A",
      email: "bad",
      password: "short",
      confirmPassword: "short",
      phone: "123",
      customerType: "Individual",
      document: "",
      fotoDePerfil: "",
    })
    expect(parsed.success).toBe(false)
    if (parsed.success) {
      return
    }
    const messages = parsed.error.issues.map((issue) => issue.message)
    expect(messages.some((message) => ENGLISH_ZOD_DEFAULTS.test(message))).toBe(
      false,
    )
    expect(messages).toContain("Envie uma foto de perfil.")
  })
})
