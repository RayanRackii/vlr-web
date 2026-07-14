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
