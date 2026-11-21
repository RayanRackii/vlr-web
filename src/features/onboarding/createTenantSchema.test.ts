import { afterEach, describe, expect, it } from "vitest"

import {
  createTenantRequestSchema,
  createTenantResponseSchema,
  isPublicOnboardingStepValid,
  parseApiError,
  type CreateTenantRequest,
} from "@/features/onboarding/createTenantSchema"
import i18n from "@/lib/i18n"

const response = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  headquartersUnitId: "22222222-2222-4222-8222-222222222222",
  adminUserId: null,
  superAdminRoleId: "33333333-3333-4333-8333-333333333333",
  supabaseAuthId: null,
  inviteId: "44444444-4444-4444-8444-444444444444",
  subdomain: "club",
}

const validRequest: CreateTenantRequest = {
  legalName: "Clube Quadras",
  taxId: "12345678000199",
  tradeName: "",
  headquartersUnitName: "Matriz",
  headquartersUnitCode: "",
  adminFullName: "Ana Costa",
  adminEmail: "ana@clube.com",
  adminPhone: "11999999999",
  isTrial: true,
}

const rawApiErrors = [
  "ANONYMOUS_TRIAL_RATE_LIMITED",
  "SIGNUP_REJECTED",
  "SIGNUP_UNAVAILABLE",
  "ANONYMOUS_TRIAL_REQUIRED",
  "Trial already used for this email or phone.",
  "AdminPassword is not accepted.",
] as const

describe("createTenant schemas", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("drops adminPassword and only accepts a trial create", () => {
    const parsed = createTenantRequestSchema.parse({
      legalName: "Clube",
      taxId: "123",
      headquartersUnitName: "Matriz",
      adminFullName: "Ana",
      adminEmail: "ana@clube.com",
      adminPhone: "11999999999",
      adminPassword: "secret-password",
      isTrial: true,
    })

    expect(parsed).not.toHaveProperty("adminPassword")
    expect(parsed.isTrial).toBe(true)
    expect(
      createTenantRequestSchema.safeParse({
        legalName: "Clube",
        taxId: "123",
        headquartersUnitName: "Matriz",
        adminFullName: "Ana",
        adminEmail: "ana@clube.com",
        adminPhone: "11999999999",
        isTrial: false,
      }).success,
    ).toBe(false)
  })

  it("accepts a trial response with null auth ids and an invite id", () => {
    expect(createTenantResponseSchema.parse(response)).toEqual(response)
    expect(
      createTenantResponseSchema.safeParse({
        ...response,
        inviteId: undefined,
      }).success,
    ).toBe(false)
  })

  it.each([
    ["pt-BR", "ANONYMOUS_TRIAL_RATE_LIMITED", "trial.onboarding.errors.rateLimited"],
    ["en", "SIGNUP_REJECTED", "trial.onboarding.errors.signupRejected"],
    ["es", "SIGNUP_UNAVAILABLE", "trial.onboarding.errors.signupUnavailable"],
    ["pt-BR", "ANONYMOUS_TRIAL_REQUIRED", "trial.onboarding.errors.trialRequired"],
    [
      "en",
      "Trial already used for this email or phone.",
      "trial.onboarding.errors.trialAlreadyUsed",
    ],
  ] as const)(
    "maps %s %s to a translated message",
    async (language, apiError, key) => {
      await i18n.changeLanguage(language)
      const message = parseApiError({ error: apiError })

      expect(message).toBe(i18n.t(key))
      expect(message).not.toBe(apiError)
    },
  )

  it.each(rawApiErrors)(
    "never returns the raw API text for %s",
    (apiError) => {
      const message = parseApiError({ error: apiError })

      expect(message).not.toBe(apiError)
      expect(message).not.toContain(apiError)
    },
  )

  it("gates each public onboarding step without later empty fields", () => {
    // Step 0 is the optional package choice: it never blocks.
    expect(isPublicOnboardingStepValid(0, { ...validRequest, legalName: "" })).toBe(true)

    expect(
      isPublicOnboardingStepValid(1, {
        ...validRequest,
        legalName: "",
        taxId: "",
      }),
    ).toBe(false)
    expect(
      isPublicOnboardingStepValid(1, {
        ...validRequest,
        legalName: "   ",
        taxId: "123",
        adminEmail: "",
        adminPhone: "",
      }),
    ).toBe(false)
    expect(
      isPublicOnboardingStepValid(1, {
        ...validRequest,
        adminFullName: "",
        adminEmail: "not-an-email",
        adminPhone: "123",
      }),
    ).toBe(true)

    expect(
      isPublicOnboardingStepValid(2, {
        ...validRequest,
        adminEmail: "not-an-email",
      }),
    ).toBe(false)
    expect(
      isPublicOnboardingStepValid(2, {
        ...validRequest,
        adminPhone: "119999999",
        legalName: "",
      }),
    ).toBe(false)
    expect(isPublicOnboardingStepValid(2, validRequest)).toBe(true)

    expect(
      isPublicOnboardingStepValid(3, {
        ...validRequest,
        legalName: "",
      }),
    ).toBe(false)
    expect(isPublicOnboardingStepValid(3, validRequest)).toBe(true)
    expect(isPublicOnboardingStepValid(4, validRequest)).toBe(false)
  })

  it("accepts only known package keys and sanitized lead fields", () => {
    const base = { ...validRequest }
    expect(
      createTenantRequestSchema.parse({
        ...base,
        packageKey: "manutencao",
        leadSource: "google",
        leadCampaign: "beach-tennis_2026",
      }),
    ).toMatchObject({ packageKey: "manutencao", leadSource: "google" })
    expect(createTenantRequestSchema.safeParse({ ...base, packageKey: "enterprise" }).success).toBe(false)
    expect(createTenantRequestSchema.safeParse({ ...base, leadSource: "x".repeat(101) }).success).toBe(false)
  })

  it("replaces an unknown API error with the generic signup message", () => {
    expect(parseApiError({ error: "provider said no" })).toBe(
      i18n.t("trial.onboarding.errors.failed"),
    )
    expect(parseApiError(null)).toBe(i18n.t("trial.onboarding.errors.failed"))
  })
})
