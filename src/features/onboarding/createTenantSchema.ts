import { z } from "zod"

import i18n from "@/lib/i18n"

function translated(key: string) {
  return {
    error: () => i18n.t(key),
  }
}

export const createTenantRequestSchema = z.object({
  legalName: z
    .string()
    .trim()
    .min(1, translated("trial.onboarding.validation.legalNameRequired")),
  taxId: z
    .string()
    .trim()
    .min(1, translated("trial.onboarding.validation.taxIdRequired")),
  tradeName: z.string().trim().optional(),
  headquartersUnitName: z
    .string()
    .trim()
    .min(1, translated("trial.onboarding.validation.headquartersRequired")),
  headquartersUnitCode: z.string().trim().optional(),
  adminFullName: z
    .string()
    .trim()
    .min(1, translated("trial.onboarding.validation.adminNameRequired")),
  adminEmail: z
    .string()
    .trim()
    .min(1, translated("trial.onboarding.validation.emailRequired"))
    .email(translated("trial.onboarding.validation.emailInvalid")),
  adminPhone: z
    .string()
    .trim()
    .min(10, translated("trial.onboarding.validation.phoneInvalid")),
  isTrial: z.literal(true),
})

export type CreateTenantRequest = z.infer<typeof createTenantRequestSchema>

export const publicOnboardingCompanyStepSchema = createTenantRequestSchema.pick({
  legalName: true,
  taxId: true,
  headquartersUnitName: true,
})

export const publicOnboardingAdminStepSchema = createTenantRequestSchema.pick({
  adminFullName: true,
  adminEmail: true,
  adminPhone: true,
})

export function isPublicOnboardingStepValid(
  step: number,
  values: CreateTenantRequest,
): boolean {
  if (step === 0) {
    return publicOnboardingCompanyStepSchema.safeParse({
      legalName: values.legalName,
      taxId: values.taxId,
      headquartersUnitName: values.headquartersUnitName,
    }).success
  }

  if (step === 1) {
    return publicOnboardingAdminStepSchema.safeParse({
      adminFullName: values.adminFullName,
      adminEmail: values.adminEmail,
      adminPhone: values.adminPhone,
    }).success
  }

  if (step === 2) {
    return createTenantRequestSchema.safeParse(values).success
  }

  return false
}

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
