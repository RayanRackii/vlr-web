import { z } from "zod"

export const MODULE_KEYS = ["Inventory", "PMOC", "OS", "Rentals"] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

export const PRICE_PER_MODULE_BRL = 199

export const step1Schema = z.object({
  legalName: z.string().trim().min(2).max(200),
  taxId: z.string().trim().min(5).max(20),
})

export const step2Schema = z.object({
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid subdomain"),
  logoSvg: z
    .string()
    .trim()
    .max(100_000)
    .refine(
      (value) =>
        value.length === 0
        || value.toLowerCase().includes("<svg"),
      "Logo must be SVG markup",
    ),
  primaryColor: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 || /^#?[0-9A-Fa-f]{6}$/.test(value),
      "Invalid hex color",
    ),
  accentColor: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 || /^#?[0-9A-Fa-f]{6}$/.test(value),
      "Invalid hex color",
    ),
  welcomeTagline: z.string().trim().max(120),
})

export const step3Schema = z.object({
  activeModules: z.array(z.enum(MODULE_KEYS)).min(1),
})

export const stepFamiliesSchema = z.object({
  assetFamilyKeys: z.array(z.string().min(1)).min(1),
})

export const stepAdminInviteSchema = z
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
        message: "Admin name is required when inviting",
      })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.addIssue({
        code: "custom",
        path: ["adminEmail"],
        message: "Valid admin email is required when inviting",
      })
    }
  })

export const tenantOnboardingSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(stepFamiliesSchema)
  .merge(stepAdminInviteSchema)

export type TenantOnboardingFormValues = z.infer<typeof tenantOnboardingSchema>

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
