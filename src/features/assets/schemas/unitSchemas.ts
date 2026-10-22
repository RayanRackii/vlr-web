import { z } from "zod"

export const unitSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().nullish(),
  isActive: z.boolean(),
})

export type Unit = z.infer<typeof unitSchema>

export const unitListSchema = z.array(unitSchema)

export const createUnitRequestSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1).optional(),
})

export type CreateUnitRequest = z.infer<typeof createUnitRequestSchema>
