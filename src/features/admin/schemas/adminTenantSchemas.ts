import { isNeverSelectableModuleKey } from "@/features/admin/schemas/adminModuleCatalogSchemas"
import { toCanonicalModuleName } from "@/features/catalog/customerNav"
import { z } from "zod"

/**
 * Canonical commercial keys used only as a WEB presentation helper (Explore módulos).
 * Not the Super-Admin selectable universe — that still comes from GET /api/admin/modules.
 * Does not include `maintenance` (legacy) or `asset-registry` (internal capability).
 */
export const KNOWN_COMMERCIAL_MODULE_KEYS = [
  "inventory",
  "pmoc",
  "os",
  "rentals",
  "catalog",
] as const

export type KnownCommercialModuleKey =
  (typeof KNOWN_COMMERCIAL_MODULE_KEYS)[number]

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
  contactEmailInvalid: string
  postalCodeInvalid: string
  stateInvalid: string
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
    contactEmailInvalid: t("admin.edit.validation.contactEmailInvalid"),
    postalCodeInvalid: t("admin.edit.validation.postalCodeInvalid"),
    stateInvalid: t("admin.edit.validation.stateInvalid"),
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
    activeModules: z.array(z.string().min(1)).min(1, messages.modulesMin),
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

  const tenantCompanySchema = z.object({
    tradeName: z.string().trim().max(200),
    contactEmail: z
      .string()
      .trim()
      .max(254)
      .refine(
        (value) => value.length === 0 || EMAIL_PATTERN.test(value),
        messages.contactEmailInvalid,
      ),
    contactPhone: z.string().trim().max(30),
    postalCode: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || value.replace(/\D/g, "").length === 8,
        messages.postalCodeInvalid,
      ),
    street: z.string().trim().max(200),
    number: z.string().trim().max(20),
    complement: z.string().trim().max(100),
    district: z.string().trim().max(100),
    city: z.string().trim().max(100),
    state: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || /^[A-Za-z]{2}$/.test(value),
        messages.stateInvalid,
      ),
  })

  const tenantEditSchema = tenantOnboardingSchema.and(tenantCompanySchema)

  return {
    step1Schema,
    step2Schema,
    step3Schema,
    stepFamiliesSchema,
    stepAdminInviteSchema,
    tenantOnboardingSchema,
    tenantCompanySchema,
    tenantEditSchema,
  }
}

export type TenantOnboardingSchemas = ReturnType<
  typeof createTenantOnboardingSchemas
>

export type TenantOnboardingFormValues = z.infer<
  TenantOnboardingSchemas["tenantOnboardingSchema"]
>

export type TenantCompanyFormValues = z.infer<
  TenantOnboardingSchemas["tenantCompanySchema"]
>

/** Platform-admin edit page: onboarding fields plus the company contact/address fields. */
export type TenantEditFormValues = TenantOnboardingFormValues &
  TenantCompanyFormValues

export function isTenantOnboardingStepValid(
  step: number,
  values: TenantOnboardingFormValues,
  schemas: TenantOnboardingSchemas,
  options?: { familiesAvailable?: boolean; modulesAvailable?: boolean },
): boolean {
  if (step === 1) {
    return schemas.step1Schema.safeParse({
      legalName: values.legalName,
      taxId: values.taxId,
    }).success
  }

  if (step === 2) {
    return schemas.step2Schema.safeParse({
      subdomain: values.subdomain,
      logoSvg: values.logoSvg,
      primaryColor: values.primaryColor,
      accentColor: values.accentColor,
      welcomeTagline: values.welcomeTagline,
    }).success
  }

  if (step === 3) {
    if (options?.modulesAvailable === false) {
      return false
    }

    return schemas.step3Schema.safeParse({
      activeModules: values.activeModules,
    }).success
  }

  if (step === 4) {
    if (options?.familiesAvailable === false) {
      return false
    }

    return schemas.stepFamiliesSchema.safeParse({
      assetFamilyKeys: values.assetFamilyKeys,
    }).success
  }

  if (step === 5) {
    return schemas.stepAdminInviteSchema.safeParse({
      adminFullName: values.adminFullName,
      adminEmail: values.adminEmail,
    }).success
  }

  if (step === 6) {
    return schemas.tenantOnboardingSchema.safeParse(values).success
  }

  return false
}

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

export const tenantAdminAddressSchema = z.object({
  postalCode: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  number: z.string().nullable().optional(),
  complement: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
})

export type TenantAdminAddress = z.infer<typeof tenantAdminAddressSchema>

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
  tradeName: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  address: tenantAdminAddressSchema.nullable().optional(),
  isTrial: z.boolean().optional(),
  isTrialReadOnly: z.boolean().optional(),
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

export const updateTenantAdminRequestSchema = createTenantAdminRequestSchema
  .omit({
    adminFullName: true,
    adminEmail: true,
  })
  .extend({
    // Null/undefined means "unchanged" on the API; an empty string clears the value.
    tradeName: z.string().nullable().optional(),
    contactEmail: z.string().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    address: tenantAdminAddressSchema.nullable().optional(),
  })

export type UpdateTenantAdminRequest = z.infer<
  typeof updateTenantAdminRequestSchema
>

export function mapTenantModuleToKey(moduleName: string): string | null {
  const canonical = toCanonicalModuleName(moduleName)
  if (canonical.length === 0 || isNeverSelectableModuleKey(canonical)) {
    return null
  }
  return canonical
}

export function tenantHasLegacyMaintenance(tenant: TenantAdmin): boolean {
  return tenant.activeModules.some(
    (module) =>
      module.isActive && toCanonicalModuleName(module.moduleName) === "maintenance",
  )
}

export function commercialModuleSelections(
  keys: readonly string[],
): string[] {
  const seen = new Set<string>()
  const selected: string[] = []

  for (const key of keys) {
    const canonical = mapTenantModuleToKey(key)
    if (canonical === null || seen.has(canonical)) {
      continue
    }
    seen.add(canonical)
    selected.push(canonical)
  }

  return selected
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
    activeModules: commercialModuleSelections(
      tenant.activeModules
        .filter((module) => module.isActive)
        .map((module) => module.moduleName),
    ),
    assetFamilyKeys: tenant.assetFamilyKeys ?? [],
    adminFullName: "",
    adminEmail: "",
  }
}

export function tenantAdminToEditFormValues(
  tenant: TenantAdmin,
): TenantEditFormValues {
  return {
    ...tenantAdminToFormValues(tenant),
    tradeName: tenant.tradeName ?? "",
    contactEmail: tenant.contactEmail ?? "",
    contactPhone: tenant.contactPhone ?? "",
    postalCode: tenant.address?.postalCode ?? "",
    street: tenant.address?.street ?? "",
    number: tenant.address?.number ?? "",
    complement: tenant.address?.complement ?? "",
    district: tenant.address?.district ?? "",
    city: tenant.address?.city ?? "",
    state: tenant.address?.state ?? "",
  }
}

const COMPANY_ADDRESS_FIELDS = [
  "postalCode",
  "street",
  "number",
  "complement",
  "district",
  "city",
  "state",
] as const satisfies readonly (keyof TenantCompanyFormValues)[]

/**
 * Company contact payload for PUT /api/admin/tenants/{id}. Only touched fields are sent
 * (undefined = unchanged); the address is replaced as a whole, so it is sent whole.
 */
export function toTenantCompanyPayload(
  values: TenantCompanyFormValues,
  dirty: Partial<Record<keyof TenantCompanyFormValues, unknown>>,
) {
  const isDirty = (key: keyof TenantCompanyFormValues) => Boolean(dirty[key])
  const addressDirty = COMPANY_ADDRESS_FIELDS.some(isDirty)

  return {
    tradeName: isDirty("tradeName") ? values.tradeName.trim() : undefined,
    contactEmail: isDirty("contactEmail") ? values.contactEmail.trim() : undefined,
    contactPhone: isDirty("contactPhone") ? values.contactPhone.trim() : undefined,
    address: addressDirty
      ? {
          postalCode: values.postalCode.replace(/\D/g, ""),
          street: values.street.trim(),
          number: values.number.trim(),
          complement: values.complement.trim(),
          district: values.district.trim(),
          city: values.city.trim(),
          state: values.state.trim().toUpperCase(),
        }
      : undefined,
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
    activeModules: commercialModuleSelections(values.activeModules),
    assetFamilyKeys: values.assetFamilyKeys,
    adminFullName: values.adminFullName.trim() || null,
    adminEmail: values.adminEmail.trim() || null,
  }
}
