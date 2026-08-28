import { z } from "zod"

export const tenantBrandingSchema = z.object({
  subdomain: z.string(),
  displayName: z.string(),
  logoSvg: z.string().nullable().optional(),
  primaryColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  welcomeTagline: z.string().nullable(),
})

export type TenantBranding = z.infer<typeof tenantBrandingSchema>

export const registrationFieldSchema = z.object({
  id: z.string().uuid(),
  fieldKey: z.string(),
  label: z.string(),
  fieldType: z.string(),
  isRequired: z.boolean(),
  sortOrder: z.number(),
  options: z.array(z.string()).nullable().optional(),
})

export type RegistrationField = z.infer<typeof registrationFieldSchema>

export const moduleMenuItemSchema = z.object({
  id: z.string().uuid(),
  moduleName: z.string(),
  label: z.string(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  rentalAssetId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
})

export type ModuleMenuItem = z.infer<typeof moduleMenuItemSchema>

export const registrationSchemaResponseSchema = z.object({
  coreFields: z.array(z.string()),
  fields: z.array(registrationFieldSchema),
})

export type RegistrationSchemaResponse = z.infer<
  typeof registrationSchemaResponseSchema
>

export const customerTypeSchema = z.enum(["Individual", "Company"])

export type CustomerType = z.infer<typeof customerTypeSchema>

export const customerAuthProfileSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  customerType: customerTypeSchema.optional(),
  document: z.string().nullable().optional(),
  cpf: z.string().nullable().optional(),
  createdAt: z.string(),
  phoneVerified: z.boolean(),
  photoUrl: z.string().nullable(),
  extraAttributes: z.record(z.string(), z.string().nullable()).optional(),
})

/** Full B2C profile (`GET`/`PATCH /api/customers/me`). Separate from login `customerAuthProfileSchema`. */
export const customerProfileSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  customerType: customerTypeSchema,
  document: z.string().nullable(),
  cpf: z.string().nullable(),
  postalCode: z.string().nullable(),
  addressStreet: z.string().nullable(),
  addressNeighborhood: z.string().nullable(),
  addressCity: z.string().nullable(),
  addressState: z.string().nullable(),
  photoUrl: z.string().nullable(),
  createdAt: z.string(),
  phoneVerified: z.boolean(),
  extraAttributes: z
    .record(z.string(), z.string().nullable())
    .nullable()
    .optional(),
})

export type CustomerProfile = z.infer<typeof customerProfileSchema>

export function buildCustomerProfileFormSchema(messages: {
  nameMin: string
  nameMax: string
}) {
  return z.object({
    name: z.string().trim().min(2, messages.nameMin).max(200, messages.nameMax),
  })
}

export type CustomerProfileFormValues = {
  name: string
}

export const authResponseSchema = z.object({
  token: z.string(),
  customer: customerAuthProfileSchema,
})

export type CustomerAuthResponse = z.infer<typeof authResponseSchema>

export const registerResponseSchema = z.object({
  customerId: z.string().uuid(),
  requiresPhoneVerification: z.boolean(),
})

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "")
}

/** CPF check digits (Brazilian algorithm). */
export function isValidCpf(raw: string): boolean {
  const digits = onlyDigits(raw)
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) {
    return false
  }

  let sum = 0
  for (let i = 0; i < 9; i += 1) {
    sum += Number(digits[i]) * (10 - i)
  }
  let remainder = sum % 11
  const digit1 = remainder < 2 ? 0 : 11 - remainder
  if (Number(digits[9]) !== digit1) {
    return false
  }

  sum = 0
  for (let i = 0; i < 10; i += 1) {
    sum += Number(digits[i]) * (11 - i)
  }
  remainder = sum % 11
  const digit2 = remainder < 2 ? 0 : 11 - remainder
  return Number(digits[10]) === digit2
}

/** CNPJ check digits (Brazilian algorithm). */
export function isValidCnpj(raw: string): boolean {
  const digits = onlyDigits(raw)
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) {
    return false
  }

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    sum += Number(digits[i]) * (weights1[i] ?? 0)
  }
  let remainder = sum % 11
  const digit1 = remainder < 2 ? 0 : 11 - remainder
  if (Number(digits[12]) !== digit1) {
    return false
  }

  sum = 0
  for (let i = 0; i < 13; i += 1) {
    sum += Number(digits[i]) * (weights2[i] ?? 0)
  }
  remainder = sum % 11
  const digit2 = remainder < 2 ? 0 : 11 - remainder
  return Number(digits[13]) === digit2
}

export function formatCpfMask(raw: string): string {
  const digits = onlyDigits(raw).slice(0, 11)
  const part1 = digits.slice(0, 3)
  const part2 = digits.slice(3, 6)
  const part3 = digits.slice(6, 9)
  const part4 = digits.slice(9, 11)
  if (digits.length <= 3) {
    return part1
  }
  if (digits.length <= 6) {
    return `${part1}.${part2}`
  }
  if (digits.length <= 9) {
    return `${part1}.${part2}.${part3}`
  }
  return `${part1}.${part2}.${part3}-${part4}`
}

export function formatCnpjMask(raw: string): string {
  const digits = onlyDigits(raw).slice(0, 14)
  const part1 = digits.slice(0, 2)
  const part2 = digits.slice(2, 5)
  const part3 = digits.slice(5, 8)
  const part4 = digits.slice(8, 12)
  const part5 = digits.slice(12, 14)
  if (digits.length <= 2) {
    return part1
  }
  if (digits.length <= 5) {
    return `${part1}.${part2}`
  }
  if (digits.length <= 8) {
    return `${part1}.${part2}.${part3}`
  }
  if (digits.length <= 12) {
    return `${part1}.${part2}.${part3}/${part4}`
  }
  return `${part1}.${part2}.${part3}/${part4}-${part5}`
}

export function formatCustomerDocument(
  customerType: CustomerType | undefined,
  document: string | null | undefined,
  cpf: string | null | undefined,
): string | null {
  const raw = document ?? cpf ?? ""
  const digits = onlyDigits(raw)
  if (digits.length === 0) {
    return null
  }
  if (customerType === "Company" || digits.length === 14) {
    return formatCnpjMask(digits)
  }
  if (digits.length === 11) {
    return formatCpfMask(digits)
  }
  return digits
}

const CORE_REGISTER_FIELD_KEYS = new Set([
  "name",
  "email",
  "password",
  "confirmPassword",
  "phone",
  "customerType",
  "document",
  "cpf",
])

export function isReservedRegisterFieldKey(fieldKey: string): boolean {
  return CORE_REGISTER_FIELD_KEYS.has(fieldKey)
}

const coreRegisterShape = {
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
  phone: z
    .string()
    .trim()
    .refine((value) => {
      const digits = onlyDigits(value)
      return digits.length === 10 || digits.length === 11
    }, "Invalid phone"),
  customerType: customerTypeSchema,
  document: z.string().trim().min(1),
}

export function buildCustomerRegisterSchema(
  fields: RegistrationField[],
  passwordMismatchMessage: string,
  documentMessages?: {
    invalidCpf: string
    invalidCnpj: string
  },
) {
  const extraShape: Record<string, z.ZodTypeAny> = {}

  for (const field of fields) {
    if (isReservedRegisterFieldKey(field.fieldKey)) {
      continue
    }

    let schema: z.ZodTypeAny

    switch (field.fieldType) {
      case "boolean":
        schema = z.boolean()
        break
      case "number":
        schema = z.coerce.number()
        break
      case "cpf":
        schema = z
          .string()
          .trim()
          .refine(
            (value) => isValidCpf(value),
            documentMessages?.invalidCpf ?? "Invalid CPF",
          )
        break
      case "cnpj":
        schema = z
          .string()
          .trim()
          .refine(
            (value) => isValidCnpj(value),
            documentMessages?.invalidCnpj ?? "Invalid CNPJ",
          )
        break
      case "cep":
        schema = z
          .string()
          .trim()
          .refine((value) => onlyDigits(value).length === 8, "Invalid CEP")
        break
      case "photo":
        schema = z.string().min(32).max(400_000)
        break
      case "email":
        schema = z.string().trim().email()
        break
      case "select":
        schema = z.string().trim().min(1)
        if (field.options && field.options.length > 0) {
          schema = z.enum(field.options as [string, ...string[]])
        }
        break
      default:
        schema = z.string().trim().min(1)
    }

    if (!field.isRequired) {
      schema =
        field.fieldType === "boolean"
          ? z.boolean().optional()
          : z.union([schema, z.literal("")]).optional()
    }

    extraShape[field.fieldKey] = schema
  }

  return z
    .object({
      ...coreRegisterShape,
      ...extraShape,
    })
    .superRefine((values, ctx) => {
      if (values.password !== values.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: passwordMismatchMessage,
        })
      }

      if (values.customerType === "Individual" && !isValidCpf(values.document)) {
        ctx.addIssue({
          code: "custom",
          path: ["document"],
          message: documentMessages?.invalidCpf ?? "Invalid CPF",
        })
      }

      if (values.customerType === "Company" && !isValidCnpj(values.document)) {
        ctx.addIssue({
          code: "custom",
          path: ["document"],
          message: documentMessages?.invalidCnpj ?? "Invalid CNPJ",
        })
      }
    })
}

export type CustomerRegisterFormValues = z.infer<
  ReturnType<typeof buildCustomerRegisterSchema>
>

export const customerLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

export type CustomerLoginFormValues = z.infer<typeof customerLoginSchema>

export const verifyPhoneSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/),
})

export type VerifyPhoneFormValues = z.infer<typeof verifyPhoneSchema>

export const FIELD_TYPE_OPTIONS = [
  "text",
  "email",
  "phone",
  "cpf",
  "cnpj",
  "cep",
  "boolean",
  "number",
  "select",
  "photo",
  "date",
] as const

export type FieldTypeOption = (typeof FIELD_TYPE_OPTIONS)[number]
