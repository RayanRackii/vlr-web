import { afterEach, describe, expect, it } from "vitest"

import {
  createTenantRequestSchema,
  createTenantResponseSchema,
  parseApiError,
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

  it("replaces an unknown API error with the generic signup message", () => {
    expect(parseApiError({ error: "provider said no" })).toBe(
      i18n.t("trial.onboarding.errors.failed"),
    )
    expect(parseApiError(null)).toBe(i18n.t("trial.onboarding.errors.failed"))
  })
})
