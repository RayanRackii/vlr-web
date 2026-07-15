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
  logoUrl: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || z.string().url().safeParse(value).success,
      "Invalid URL",
    ),
})

export const step3Schema = z.object({
  activeModules: z.array(z.enum(MODULE_KEYS)).min(1),
})

export const tenantOnboardingSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)

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
  logoUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  activeModules: z.array(tenantModuleSchema),
})

export const tenantAdminListSchema = z.array(tenantAdminSchema)

export type TenantAdmin = z.infer<typeof tenantAdminSchema>

export const createTenantAdminRequestSchema = z.object({
  legalName: z.string(),
  taxId: z.string(),
  subdomain: z.string(),
  logoUrl: z.string().nullable().optional(),
  activeModules: z.array(z.string()).min(1),
})

export type CreateTenantAdminRequest = z.infer<
  typeof createTenantAdminRequestSchema
>

export const updateTenantAdminRequestSchema = createTenantAdminRequestSchema

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
    logoUrl: tenant.logoUrl ?? "",
    activeModules: tenant.activeModules
      .filter((module) => module.isActive)
      .map((module) => mapTenantModuleToKey(module.moduleName))
      .filter((moduleKey): moduleKey is ModuleKey => moduleKey !== null),
  }
}
