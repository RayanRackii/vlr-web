import { describe, expect, it } from "vitest"

import {
  companyProfileSchema,
  createCompanyFormSchema,
  emptyCompanyForm,
  formToWriteBody,
  profileToForm,
} from "@/features/company/schemas/companySchemas"

const messages = { legalNameRequired: "name", taxIdRequired: "taxreq", taxIdInvalid: "tax", emailInvalid: "mail", phoneInvalid: "phone", postalCodeInvalid: "cep", stateInvalid: "uf" }
const schema = createCompanyFormSchema(messages)
const valid = { ...emptyCompanyForm, legalName: "Clube Ltda" }

function firstMessage(values: object): string | undefined {
  const result = schema.safeParse(values)
  return result.success ? undefined : result.error.issues[0]?.message
}

describe("company form schema", () => {
  const withTaxId = { ...valid, taxId: "529.982.247-25" }

  it("requires the legal name and the CPF/CNPJ, as the API does", () => {
    expect(schema.safeParse(withTaxId).success).toBe(true)
    expect(firstMessage({ ...withTaxId, legalName: "  " })).toBe("name")
    expect(firstMessage(valid)).toBe("taxreq")
    expect(firstMessage({ ...valid, taxId: "  " })).toBe("taxreq")
  })

  it("accepts a valid CPF and CNPJ (masked or not) and rejects bad check digits", () => {
    expect(schema.safeParse({ ...valid, taxId: "529.982.247-25" }).success).toBe(true)
    expect(schema.safeParse({ ...valid, taxId: "11.222.333/0001-81" }).success).toBe(true)
    expect(firstMessage({ ...valid, taxId: "529.982.247-26" })).toBe("tax")
    expect(firstMessage({ ...valid, taxId: "123" })).toBe("tax")
  })

  it("validates e-mail, phone, CEP and UF only when filled", () => {
    expect(firstMessage({ ...withTaxId, contactEmail: "nope" })).toBe("mail")
    expect(firstMessage({ ...withTaxId, contactPhone: "123" })).toBe("phone")
    expect(firstMessage({ ...withTaxId, postalCode: "1234" })).toBe("cep")
    expect(firstMessage({ ...withTaxId, state: "S" })).toBe("uf")
    expect(schema.safeParse({ ...valid, contactEmail: "a@b.com", contactPhone: "(11) 91234-5678", postalCode: "01310-100", state: "SP", taxId: "529.982.247-25" }).success).toBe(true)
  })
})

describe("company profile mapping", () => {
  it("tolerates nulls and a missing address", () => {
    const profile = companyProfileSchema.parse({ legalName: "X", tradeName: null })
    expect(profile.address.city).toBe("")
    expect(profileToForm(profile).tradeName).toBe("")
  })

  it("sends digits only and null for blank optional fields", () => {
    const body = formToWriteBody({ ...valid, taxId: "529.982.247-25", contactPhone: "+55 (11) 91234-5678", postalCode: "01310-100", state: "sp", city: " " })
    expect(body).toMatchObject({ legalName: "Clube Ltda", tradeName: null, taxId: "52998224725", contactEmail: null, contactPhone: "5511912345678" })
    expect(body.address).toMatchObject({ postalCode: "01310100", state: "SP", city: null, street: null })
  })
})
