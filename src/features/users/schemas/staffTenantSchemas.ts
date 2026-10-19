import { z } from "zod"

export const staffTenantMembershipSchema = z.object({
  tenantId: z.string().uuid(),
  legalName: z.string(),
  tradeName: z.string().nullable(),
  subdomain: z.string().nullable(),
})

export type StaffTenantMembership = z.infer<typeof staffTenantMembershipSchema>

export const staffTenantMembershipListSchema = z.object({
  accessTokenTenantId: z.string().uuid().nullable(),
  authMetadataTenantId: z.string().uuid().nullable(),
  sessionRefreshRequired: z.boolean(),
  memberships: z.array(staffTenantMembershipSchema),
})

export type StaffTenantMembershipList = z.infer<
  typeof staffTenantMembershipListSchema
>

export const selectStaffTenantResponseSchema = z.object({
  tenantId: z.string().uuid(),
  legalName: z.string(),
  tradeName: z.string().nullable(),
  subdomain: z.string().nullable(),
  sessionRefreshRequired: z.boolean(),
})

export type SelectStaffTenantResponse = z.infer<
  typeof selectStaffTenantResponseSchema
>
