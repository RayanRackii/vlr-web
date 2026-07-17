import { z } from "zod"

export const applicationRoleSchema = z.enum([
  "SUPER_ADMIN",
  "ADMIN",
  "TECHNICIAN",
  "USER",
  "CLIENT",
])

export type ApplicationRole = z.infer<typeof applicationRoleSchema>

export const currentUserSchema = z.object({
  id: z.string().uuid().nullish(),
  fullName: z.string(),
  email: z.string(),
  role: applicationRoleSchema,
})

export type CurrentUser = z.infer<typeof currentUserSchema>

export const technicianUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string(),
})

export const technicianUserListSchema = z.array(technicianUserSchema)

export type TechnicianUser = z.infer<typeof technicianUserSchema>
