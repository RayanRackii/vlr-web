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

export const customerAuthProfileSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.string(),
  phoneVerified: z.boolean(),
  photoUrl: z.string().nullable(),
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

export const customerRegisterSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
  cpf: z
    .string()
    .trim()
    .refine((value) => isValidCpf(value), "Invalid CPF"),
  postalCode: z
    .string()
    .trim()
    .refine((value) => onlyDigits(value).length === 8, "Invalid CEP"),
  phone: z
    .string()
    .trim()
    .refine((value) => {
      const digits = onlyDigits(value)
      return digits.length === 10 || digits.length === 11
    }, "Invalid phone"),
  photoDataUrl: z.string().min(32).max(400_000),
})

export type CustomerRegisterFormValues = z.infer<typeof customerRegisterSchema>

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
