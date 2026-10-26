import { z } from "zod"

export const applicationRoleSchema = z.enum([
  "SUPER_ADMIN",
  "ADMIN",
  "TECHNICIAN",
  "USER",
  "CLIENT",
])

export type ApplicationRole = z.infer<typeof applicationRoleSchema>

export const tenantRoleRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isSystemRole: z.boolean(),
})

export type TenantRoleRef = z.infer<typeof tenantRoleRefSchema>

export const currentUserSchema = z.object({
  id: z.string().uuid().nullish(),
  fullName: z.string(),
  email: z.string(),
  role: applicationRoleSchema,
  tenantId: z.string().uuid().nullish(),
  activeModules: z.array(z.string()).default([]),
  activeAssetFamilies: z.array(z.string()).default([]),
  isTrial: z.boolean().default(false),
  trialEndsAt: z.string().nullable().optional(),
  trialPurgeAt: z.string().nullable().optional(),
  isTrialReadOnly: z.boolean().default(false),
  notificationsEmailOnly: z.boolean().default(false),
  roles: z.array(tenantRoleRefSchema).default([]),
  permissions: z.array(z.string()).default([]),
  tenantTradeName: z.string().nullish(),
  tenantLegalName: z.string().nullish(),
  timeZoneId: z.string().optional(),
})

export type CurrentUser = z.infer<typeof currentUserSchema>

export const technicianUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string(),
})

export const technicianUserListSchema = z.array(technicianUserSchema)

export type TechnicianUser = z.infer<typeof technicianUserSchema>

export const tenantMemberSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  isActive: z.boolean(),
  roles: z.array(tenantRoleRefSchema).default([]),
})

export const tenantMemberListSchema = z.array(tenantMemberSchema)

export type TenantMember = z.infer<typeof tenantMemberSchema>

export function pagedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  })
}

export const tenantMemberPageSchema = pagedSchema(tenantMemberSchema)

export type TenantMemberPage = z.infer<typeof tenantMemberPageSchema>

export const tenantCustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.string(),
})

export const tenantCustomerPageSchema = pagedSchema(tenantCustomerSchema)

export type TenantCustomer = z.infer<typeof tenantCustomerSchema>
export type TenantCustomerPage = z.infer<typeof tenantCustomerPageSchema>

export type DirectoryQuery = {
  q?: string
  page?: number
  pageSize?: number
}

export const inviteTenantMemberRequestSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  roleIds: z.array(z.string().uuid()).min(1),
})

export type InviteTenantMemberRequest = z.infer<
  typeof inviteTenantMemberRequestSchema
>

export const inviteTenantMemberResponseSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  roleName: z.string(),
  expiresAt: z.string(),
})

export type InviteTenantMemberResponse = z.infer<
  typeof inviteTenantMemberResponseSchema
>

export const assignUserRolesRequestSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1),
})

export type AssignUserRolesRequest = z.infer<typeof assignUserRolesRequestSchema>

export function createInviteMemberFormSchema(messages: {
  fullNameRequired: string
  emailInvalid: string
  rolesRequired: string
}) {
  return z.object({
    fullName: z.string().trim().min(2, messages.fullNameRequired),
    email: z.string().trim().email(messages.emailInvalid),
    roleIds: z.array(z.string().uuid()).min(1, messages.rolesRequired),
  })
}

export type InviteMemberFormValues = z.infer<
  ReturnType<typeof createInviteMemberFormSchema>
>

export function createAssignRolesFormSchema(messages: {
  rolesRequired: string
}) {
  return z.object({
    roleIds: z.array(z.string().uuid()).min(1, messages.rolesRequired),
  })
}

export type AssignRolesFormValues = z.infer<
  ReturnType<typeof createAssignRolesFormSchema>
>
