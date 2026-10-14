import { z } from "zod"

import i18n from "@/lib/i18n"

export const createTenantRequestSchema = z.object({
  legalName: z.string().trim().min(1, "Razão social é obrigatória."),
  taxId: z.string().trim().min(1, "CNPJ/CPF é obrigatório."),
  tradeName: z.string().trim().optional(),
  headquartersUnitName: z
    .string()
    .trim()
    .min(1, "Nome da unidade matriz é obrigatório."),
  headquartersUnitCode: z.string().trim().optional(),
  adminFullName: z.string().trim().min(1, "Nome do administrador é obrigatório."),
  adminEmail: z
    .string()
    .trim()
    .min(1, "E-mail é obrigatório.")
    .email("Informe um e-mail válido."),
  adminPhone: z
    .string()
    .trim()
    .min(10, "Informe um celular válido com DDD."),
  isTrial: z.literal(true),
})

export type CreateTenantRequest = z.infer<typeof createTenantRequestSchema>

export const createTenantResponseSchema = z.object({
  tenantId: z.string().uuid(),
  headquartersUnitId: z.string().uuid(),
  adminUserId: z.string().uuid().nullable(),
  superAdminRoleId: z.string().uuid(),
  supabaseAuthId: z.string().min(1).nullable(),
  inviteId: z.string().uuid(),
  subdomain: z.string().nullable().optional(),
})

export type CreateTenantResponse = z.infer<typeof createTenantResponseSchema>

const apiErrorSchema = z.object({
  error: z.string(),
})

const onboardingErrorMessageKeys = {
  ANONYMOUS_TRIAL_RATE_LIMITED: "trial.onboarding.errors.rateLimited",
  SIGNUP_REJECTED: "trial.onboarding.errors.signupRejected",
  SIGNUP_UNAVAILABLE: "trial.onboarding.errors.signupUnavailable",
  ANONYMOUS_TRIAL_REQUIRED: "trial.onboarding.errors.trialRequired",
  "Trial already used for this email or phone.":
    "trial.onboarding.errors.trialAlreadyUsed",
} as const

type OnboardingApiError = keyof typeof onboardingErrorMessageKeys

function isOnboardingApiError(value: string): value is OnboardingApiError {
  return Object.prototype.hasOwnProperty.call(onboardingErrorMessageKeys, value)
}

export function parseApiError(payload: unknown): string {
  const parsed = apiErrorSchema.safeParse(payload)
  const fallback = i18n.t("trial.onboarding.errors.failed")

  if (!parsed.success || !isOnboardingApiError(parsed.data.error)) {
    return fallback
  }

  return i18n.t(onboardingErrorMessageKeys[parsed.data.error])
}
