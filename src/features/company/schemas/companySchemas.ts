import { z } from "zod"

import { isValidBrazilianPhoneDigits, isValidCnpj, isValidCpf, onlyDigits } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

const nullableText = z.string().nullish().transform((value) => value ?? "")

/** GET/PUT /api/company. Every field is tolerated as absent so older APIs keep working. */
export const companyProfileSchema = z.object({
  legalName: nullableText,
  tradeName: nullableText,
  taxId: nullableText,
  contactEmail: nullableText,
  contactPhone: nullableText,
  address: z
    .object({
      postalCode: nullableText,
      street: nullableText,
      number: nullableText,
      complement: nullableText,
      district: nullableText,
      city: nullableText,
      state: nullableText,
    })
    .nullish()
    .transform((value) => value ?? { postalCode: "", street: "", number: "", complement: "", district: "", city: "", state: "" }),
  /** Read-only: the portal address. */
  subdomain: nullableText,
})

export type CompanyProfile = z.infer<typeof companyProfileSchema>

export type CompanyFormValues = {
  legalName: string
  tradeName: string
  taxId: string
  contactEmail: string
  contactPhone: string
  postalCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

export const emptyCompanyForm: CompanyFormValues = {
  legalName: "", tradeName: "", taxId: "", contactEmail: "", contactPhone: "",
  postalCode: "", street: "", number: "", complement: "", district: "", city: "", state: "",
}

/** Body of PUT /api/company; blank optional fields are sent as null so they can be cleared. */
export type CompanyWriteBody = {
  legalName: string
  tradeName: string | null
  taxId: string
  contactEmail: string | null
  contactPhone: string | null
  address: {
    postalCode: string | null
    street: string | null
    number: string | null
    complement: string | null
    district: string | null
    city: string | null
    state: string | null
  }
}

export function profileToForm(profile: CompanyProfile): CompanyFormValues {
  return {
    legalName: profile.legalName,
    tradeName: profile.tradeName,
    taxId: profile.taxId,
    contactEmail: profile.contactEmail,
    contactPhone: profile.contactPhone,
    postalCode: profile.address.postalCode,
    street: profile.address.street,
    number: profile.address.number,
    complement: profile.address.complement,
    district: profile.address.district,
    city: profile.address.city,
    state: profile.address.state,
  }
}

const blankToNull = (value: string): string | null => (value.trim() === "" ? null : value.trim())
const digitsOrNull = (value: string): string | null => (onlyDigits(value) === "" ? null : onlyDigits(value))

export function formToWriteBody(values: CompanyFormValues): CompanyWriteBody {
  return {
    legalName: values.legalName.trim(),
    tradeName: blankToNull(values.tradeName),
    taxId: onlyDigits(values.taxId),
    contactEmail: blankToNull(values.contactEmail),
    contactPhone: digitsOrNull(values.contactPhone),
    address: {
      postalCode: digitsOrNull(values.postalCode),
      street: blankToNull(values.street),
      number: blankToNull(values.number),
      complement: blankToNull(values.complement),
      district: blankToNull(values.district),
      city: blankToNull(values.city),
      state: blankToNull(values.state)?.toUpperCase() ?? null,
    },
  }
}

export type CompanyFormMessages = {
  legalNameRequired: string
  taxIdRequired: string
  taxIdInvalid: string
  emailInvalid: string
  phoneInvalid: string
  postalCodeInvalid: string
  stateInvalid: string
}

/** Same rules as the API: legal name required; legal name and CPF/CNPJ required; e-mail, phone, CEP and UF only when filled. */
export function createCompanyFormSchema(messages: CompanyFormMessages) {
  const maxText = (max: number) => z.string().max(max)
  return z.object({
    legalName: z.string().trim().min(1, messages.legalNameRequired).max(200),
    tradeName: maxText(200),
    taxId: z.string()
      .refine((value) => onlyDigits(value) !== "", messages.taxIdRequired)
      .refine((value) => {
        const digits = onlyDigits(value)
        return digits === "" || (digits.length === 11 ? isValidCpf(digits) : digits.length === 14 && isValidCnpj(digits))
      }, messages.taxIdInvalid),
    contactEmail: z.string().trim().max(200).refine((value) => value === "" || z.string().email().safeParse(value).success, messages.emailInvalid),
    contactPhone: z.string().refine((value) => value.trim() === "" || isValidBrazilianPhoneDigits(value), messages.phoneInvalid),
    postalCode: z.string().refine((value) => onlyDigits(value) === "" || onlyDigits(value).length === 8, messages.postalCodeInvalid),
    street: maxText(200),
    number: maxText(30),
    complement: maxText(100),
    district: maxText(100),
    city: maxText(100),
    state: z.string().refine((value) => value === "" || /^[A-Za-z]{2}$/.test(value), messages.stateInvalid),
  })
}
