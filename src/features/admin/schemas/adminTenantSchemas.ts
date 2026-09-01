import { z } from "zod"

export const MODULE_KEYS = ["Inventory", "PMOC", "OS", "Rentals", "Catalog"] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

export const PRICE_PER_MODULE_BRL = 199

const SUBDOMAIN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HEX_COLOR_PATTERN = /^#?[0-9A-Fa-f]{6}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type TenantOnboardingValidationMessages = {
  legalNameMin: string
  legalNameMax: string
  taxIdMin: string
  taxIdMax: string
  subdomainMin: string
  subdomainMax: string
  subdomainFormat: string
  logoSvgInvalid: string
  hexColorInvalid: string
  welcomeTaglineMax: string
  modulesMin: string
  familiesMin: string
  adminNameRequired: string
  adminEmailInvalid: string
}

export function tenantOnboardingMessagesFromT(
  t: (key: string) => string,
): TenantOnboardingValidationMessages {
  return {
    legalNameMin: t("admin.wizard.validation.legalNameMin"),
    legalNameMax: t("admin.wizard.validation.legalNameMax"),
    taxIdMin: t("admin.wizard.validation.taxIdMin"),
    taxIdMax: t("admin.wizard.validation.taxIdMax"),
    subdomainMin: t("admin.wizard.validation.subdomainMin"),
    subdomainMax: t("admin.wizard.validation.subdomainMax"),
    subdomainFormat: t("admin.wizard.validation.subdomainFormat"),
    logoSvgInvalid: t("admin.wizard.validation.logoSvgInvalid"),
    hexColorInvalid: t("admin.wizard.validation.hexColorInvalid"),
    welcomeTaglineMax: t("admin.wizard.validation.welcomeTaglineMax"),
    modulesMin: t("admin.wizard.validation.modulesMin"),
    familiesMin: t("admin.wizard.validation.familiesMin"),
    adminNameRequired: t("admin.wizard.validation.adminNameRequired"),
    adminEmailInvalid: t("admin.wizard.validation.adminEmailInvalid"),
  }
}

export function createTenantOnboardingSchemas(
  messages: TenantOnboardingValidationMessages,
) {
  const step1Schema = z.object({
    legalName: z
      .string()
      .trim()
      .min(2, messages.legalNameMin)
      .max(200, messages.legalNameMax),
    taxId: z
      .string()
      .trim()
      .min(5, messages.taxIdMin)
      .max(20, messages.taxIdMax),
  })

  const step2Schema = z.object({
    subdomain: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, messages.subdomainMin)
      .max(63, messages.subdomainMax)
      .regex(SUBDOMAIN_PATTERN, messages.subdomainFormat),
    logoSvg: z
      .string()
      .trim()
      .max(100_000)
      .refine(
        (value) => value.length === 0 || value.toLowerCase().includes("<svg"),
        messages.logoSvgInvalid,
      ),
    primaryColor: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || HEX_COLOR_PATTERN.test(value),
        messages.hexColorInvalid,
      ),
    accentColor: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || HEX_COLOR_PATTERN.test(value),
        messages.hexColorInvalid,
      ),
    welcomeTagline: z.string().trim().max(120, messages.welcomeTaglineMax),
  })

  const step3Schema = z.object({
    activeModules: z.array(z.enum(MODULE_KEYS)).min(1, messages.modulesMin),
  })

  const stepFamiliesSchema = z.object({
    assetFamilyKeys: z.array(z.string().min(1)).min(1, messages.familiesMin),
  })

  const stepAdminInviteSchema = z
    .object({
      adminFullName: z.string().trim().max(200),
      adminEmail: z.string().trim().max(320),
    })
    .superRefine((value, ctx) => {
      const name = value.adminFullName
      const email = value.adminEmail
      const anyFilled = name.length > 0 || email.length > 0
      if (!anyFilled) {
        return
      }

      if (name.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["adminFullName"],
          message: messages.adminNameRequired,
        })
      }

      if (!EMAIL_PATTERN.test(email)) {
        ctx.addIssue({
          code: "custom",
          path: ["adminEmail"],
          message: messages.adminEmailInvalid,
        })
      }
    })

  const tenantOnboardingSchema = step1Schema
    .merge(step2Schema)
    .merge(step3Schema)
    .merge(stepFamiliesSchema)
    .merge(stepAdminInviteSchema)

  return {
    step1Schema,
    step2Schema,
    step3Schema,
    stepFamiliesSchema,
    stepAdminInviteSchema,
    tenantOnboardingSchema,
  }
}

export type TenantOnboardingFormValues = z.infer<
  ReturnType<typeof createTenantOnboardingSchemas>["tenantOnboardingSchema"]
>

export const {
  step1Schema,
  step2Schema,
  step3Schema,
  stepFamiliesSchema,
  stepAdminInviteSchema,
  tenantOnboardingSchema,
} = createTenantOnboardingSchemas(
  tenantOnboardingMessagesFromT((key) => key),
)

export const tenantModuleSchema = z.object({
  moduleName: z.string(),
  isActive: z.boolean(),
})

export const tenantAdminSchema = z.object({
  id: z.string().uuid(),
  legalName: z.string(),
  taxId: z.string(),
  subdomain: z.string().nullable(),
  logoSvg: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  welcomeTagline: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  activeModules: z.array(tenantModuleSchema),
  assetFamilyKeys: z.array(z.string()).default([]),
})

export const tenantAdminListSchema = z.array(tenantAdminSchema)

export type TenantAdmin = z.infer<typeof tenantAdminSchema>

export const createTenantAdminRequestSchema = z.object({
  legalName: z.string(),
  taxId: z.string(),
  subdomain: z.string(),
  logoSvg: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  welcomeTagline: z.string().nullable().optional(),
  activeModules: z.array(z.string()).min(1),
  assetFamilyKeys: z.array(z.string()).min(1),
  adminFullName: z.string().nullable().optional(),
  adminEmail: z.string().nullable().optional(),
})

export type CreateTenantAdminRequest = z.infer<
  typeof createTenantAdminRequestSchema
>

export const updateTenantAdminRequestSchema = createTenantAdminRequestSchema.omit({
  adminFullName: true,
  adminEmail: true,
})

export type UpdateTenantAdminRequest = z.infer<
  typeof updateTenantAdminRequestSchema
>

const MODULE_NAME_TO_KEY: Record<string, ModuleKey> = {
  inventory: "Inventory",
  pmoc: "PMOC",
  os: "OS",
  rentals: "Rentals",
  catalog: "Catalog",
}

export function mapTenantModuleToKey(moduleName: string): ModuleKey | null {
  return MODULE_NAME_TO_KEY[moduleName.toLowerCase()] ?? null
}

export function tenantAdminToFormValues(
  tenant: TenantAdmin,
): TenantOnboardingFormValues {
  return {
    legalName: tenant.legalName,
    taxId: tenant.taxId,
    subdomain: tenant.subdomain ?? "",
    logoSvg: tenant.logoSvg ?? "",
    primaryColor: tenant.primaryColor ?? "",
    accentColor: tenant.accentColor ?? "",
    welcomeTagline: tenant.welcomeTagline ?? "",
    activeModules: tenant.activeModules
      .filter((module) => module.isActive)
      .map((module) => mapTenantModuleToKey(module.moduleName))
      .filter((moduleKey): moduleKey is ModuleKey => moduleKey !== null),
    assetFamilyKeys: tenant.assetFamilyKeys ?? [],
    adminFullName: "",
    adminEmail: "",
  }
}

function normalizeOptionalHex(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (trimmed.length === 0) {
    return null
  }
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`
}

export function toTenantBrandingPayload(values: TenantOnboardingFormValues) {
  return {
    logoSvg: values.logoSvg?.trim() ? values.logoSvg.trim() : null,
    primaryColor: normalizeOptionalHex(values.primaryColor),
    accentColor: normalizeOptionalHex(values.accentColor),
    welcomeTagline: values.welcomeTagline?.trim()
      ? values.welcomeTagline.trim()
      : null,
  }
}

export function toCreateTenantAdminRequest(
  values: TenantOnboardingFormValues,
): CreateTenantAdminRequest {
  return {
    legalName: values.legalName.trim(),
    taxId: values.taxId.trim(),
    subdomain: values.subdomain.trim().toLowerCase(),
    ...toTenantBrandingPayload(values),
    activeModules: values.activeModules,
    assetFamilyKeys: values.assetFamilyKeys,
    adminFullName: values.adminFullName.trim() || null,
    adminEmail: values.adminEmail.trim() || null,
  }
}
