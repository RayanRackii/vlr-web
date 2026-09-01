import { describe, expect, it } from "vitest"

import {
  createTenantOnboardingSchemas,
  isTenantOnboardingStepValid,
  tenantOnboardingMessagesFromT,
  toCreateTenantAdminRequest,
  type TenantOnboardingFormValues,
} from "@/features/admin/schemas/adminTenantSchemas"
import i18n from "@/lib/i18n"

const messages = tenantOnboardingMessagesFromT((key) => i18n.t(key))
const schemas = createTenantOnboardingSchemas(messages)

function issuesOf(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  if (result.success || !result.error) {
    return []
  }

  return result.error.issues.map((issue) => issue.message)
}

describe("tenant onboarding validation messages", () => {
  it("uses a specific pt-BR message for an empty legal name, never Invalid input", () => {
    const result = schemas.step1Schema.safeParse({ legalName: "  ", taxId: "12345" })
    const messagesFound = issuesOf(result)

    expect(result.success).toBe(false)
    expect(messagesFound).toContain(i18n.t("admin.wizard.validation.legalNameMin"))
    expect(messagesFound.join(" ")).not.toContain("Invalid input")
  })

  it("uses a specific pt-BR message for a malformed subdomain", () => {
    const result = schemas.step2Schema.safeParse({
      subdomain: "Bad_Sub",
      logoSvg: "",
      primaryColor: "",
      accentColor: "",
      welcomeTagline: "",
    })
    const messagesFound = issuesOf(result)

    expect(result.success).toBe(false)
    expect(messagesFound).toContain(i18n.t("admin.wizard.validation.subdomainFormat"))
    expect(messagesFound.join(" ")).not.toContain("Invalid input")
  })

  it("uses a specific pt-BR message when no modules are selected", () => {
    const result = schemas.step3Schema.safeParse({ activeModules: [] })
    const messagesFound = issuesOf(result)

    expect(result.success).toBe(false)
    expect(messagesFound).toContain(i18n.t("admin.wizard.validation.modulesMin"))
    expect(messagesFound.join(" ")).not.toContain("Invalid input")
  })

  it("uses a specific pt-BR message when admin email is filled without a valid address", () => {
    const result = schemas.stepAdminInviteSchema.safeParse({
      adminFullName: "Maria Silva",
      adminEmail: "not-an-email",
    })
    const messagesFound = issuesOf(result)

    expect(result.success).toBe(false)
    expect(messagesFound).toContain(i18n.t("admin.wizard.validation.adminEmailInvalid"))
    expect(messagesFound.join(" ")).not.toContain("Invalid input")
  })
})

const emptyWizardValues: TenantOnboardingFormValues = {
  legalName: "",
  taxId: "",
  subdomain: "",
  logoSvg: "",
  primaryColor: "",
  accentColor: "",
  welcomeTagline: "",
  activeModules: [],
  assetFamilyKeys: [],
  adminFullName: "",
  adminEmail: "",
}

const completeWizardValues: TenantOnboardingFormValues = {
  legalName: "Clube Acme",
  taxId: "12345",
  subdomain: "acme",
  logoSvg: "",
  primaryColor: "#4D6A92",
  accentColor: "",
  welcomeTagline: "",
  activeModules: ["Rentals"],
  assetFamilyKeys: ["spaces"],
  adminFullName: "",
  adminEmail: "",
}

describe("isTenantOnboardingStepValid", () => {
  it("rejects an empty step 1", () => {
    expect(isTenantOnboardingStepValid(1, emptyWizardValues, schemas)).toBe(
      false,
    )
  })

  it("rejects step 4 when no families are selected", () => {
    expect(isTenantOnboardingStepValid(4, emptyWizardValues, schemas)).toBe(
      false,
    )
  })

  it("treats step 4 as invalid when the catalog is unavailable", () => {
    expect(
      isTenantOnboardingStepValid(4, completeWizardValues, schemas, {
        familiesAvailable: false,
      }),
    ).toBe(false)
  })

  it("accepts step 5 when both admin invite fields are blank", () => {
    expect(isTenantOnboardingStepValid(5, emptyWizardValues, schemas)).toBe(
      true,
    )
  })

  it("uses the full schema on step 6", () => {
    expect(isTenantOnboardingStepValid(6, emptyWizardValues, schemas)).toBe(
      false,
    )
    expect(isTenantOnboardingStepValid(6, completeWizardValues, schemas)).toBe(
      true,
    )
    expect(
      isTenantOnboardingStepValid(
        6,
        { ...completeWizardValues, legalName: "" },
        schemas,
      ),
    ).toBe(false)
  })
})

describe("toCreateTenantAdminRequest", () => {
  it("maps wizard values to the unchanged createAdminTenant body shape", () => {
    const values: TenantOnboardingFormValues = {
      legalName: "  Clube Acme  ",
      taxId: " 12.345.678/0001-90 ",
      subdomain: "Acme-Clube",
      logoSvg: "  <svg></svg>  ",
      primaryColor: "4D6A92",
      accentColor: "",
      welcomeTagline: "  Bem-vindo  ",
      activeModules: ["Rentals", "Inventory"],
      assetFamilyKeys: ["spaces"],
      adminFullName: "  Maria Silva  ",
      adminEmail: "  maria@acme.com  ",
    }

    expect(toCreateTenantAdminRequest(values)).toEqual({
      legalName: "Clube Acme",
      taxId: "12.345.678/0001-90",
      subdomain: "acme-clube",
      logoSvg: "<svg></svg>",
      primaryColor: "#4D6A92",
      accentColor: null,
      welcomeTagline: "Bem-vindo",
      activeModules: ["Rentals", "Inventory"],
      assetFamilyKeys: ["spaces"],
      adminFullName: "Maria Silva",
      adminEmail: "maria@acme.com",
    })
  })

  it("sends null optional admin fields when they are blank", () => {
    const values: TenantOnboardingFormValues = {
      legalName: "Clube",
      taxId: "12345",
      subdomain: "clube",
      logoSvg: "",
      primaryColor: "",
      accentColor: "",
      welcomeTagline: "",
      activeModules: ["OS"],
      assetFamilyKeys: ["generic"],
      adminFullName: "   ",
      adminEmail: "",
    }

    const payload = toCreateTenantAdminRequest(values)

    expect(payload.adminFullName).toBeNull()
    expect(payload.adminEmail).toBeNull()
    expect(payload.logoSvg).toBeNull()
    expect(payload.primaryColor).toBeNull()
    expect(payload.accentColor).toBeNull()
    expect(payload.welcomeTagline).toBeNull()
  })
})
