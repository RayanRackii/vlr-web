import { z } from "zod"

export const tenantBrandingSchema = z.object({
  subdomain: z.string(),
  displayName: z.string(),
  logoUrl: z.string().nullable(),
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

export const customerAuthProfileSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.string(),
  phoneVerified: z.boolean(),
  photoUrl: z.string().nullable(),
  extraAttributes: z.record(z.string(), z.string().nullable()).optional(),
})

export const authResponseSchema = z.object({
  token: z.string(),
  customer: customerAuthProfileSchema,
})

export type CustomerAuthResponse = z.infer<typeof authResponseSchema>

export const registerResponseSchema = z.object({
  customerId: z.string().uuid(),
  requiresPhoneVerification: z.boolean(),
})

function onlyDigits(value: string): string {
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
}

export function buildCustomerRegisterSchema(
  fields: RegistrationField[],
  passwordMismatchMessage: string,
) {
  const extraShape: Record<string, z.ZodTypeAny> = {}

  for (const field of fields) {
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
          .refine((value) => isValidCpf(value), "Invalid CPF")
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
    .refine((values) => values.password === values.confirmPassword, {
      message: passwordMismatchMessage,
      path: ["confirmPassword"],
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
  "cep",
  "boolean",
  "number",
  "select",
  "photo",
  "date",
] as const

export type FieldTypeOption = (typeof FIELD_TYPE_OPTIONS)[number]
