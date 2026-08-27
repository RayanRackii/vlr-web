import { z } from "zod"

export const roleResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullish(),
  isSystemRole: z.boolean(),
  permissionKeys: z.array(z.string()).default([]),
})

export const roleResponseListSchema = z.array(roleResponseSchema)

export type RoleResponse = z.infer<typeof roleResponseSchema>

export const permissionCatalogItemSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  moduleKey: z.string().nullish(),
  resource: z.string(),
})

export const permissionCatalogListSchema = z.array(permissionCatalogItemSchema)

export type PermissionCatalogItemDto = z.infer<typeof permissionCatalogItemSchema>

export const createRoleRequestSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  permissionKeys: z.array(z.string()),
})

export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>

export function createRoleFormSchema(messages: { nameRequired: string }) {
  return z.object({
    name: z.string().trim().min(2, messages.nameRequired),
    description: z.string().optional(),
    permissionKeys: z.array(z.string()),
  })
}

export type RoleFormValues = z.infer<ReturnType<typeof createRoleFormSchema>>
