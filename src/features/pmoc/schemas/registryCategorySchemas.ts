import { z } from "zod"

export const registryCategoryListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
})

export type RegistryCategoryListItem = z.infer<
  typeof registryCategoryListItemSchema
>

export const registryCategoryListSchema = z.array(registryCategoryListItemSchema)
