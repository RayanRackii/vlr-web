import { z } from "zod"

export const taxonomyIconKeys = [
  "folder",
  "tag",
  "package",
  "map-pin",
  "calendar",
  "star",
] as const

export const taxonomyIconKeySchema = z.enum(taxonomyIconKeys)

export const taxonomyCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(80),
  parentId: z.string().uuid().nullable(),
  icon: taxonomyIconKeySchema.nullable(),
  sortOrder: z.number().int().min(0).max(100000),
})

export const taxonomyTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(80),
})

export const taxonomyOptionsSchema = z.object({
  categories: z.array(taxonomyCategorySchema),
  tags: z.array(taxonomyTagSchema),
})

export const taxonomyAssignmentSchema = z.object({
  categories: z.array(taxonomyCategorySchema),
  tags: z.array(taxonomyTagSchema),
})

export const taxonomyMutationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentId: z.string().uuid().nullable(),
  icon: taxonomyIconKeySchema.nullable(),
  sortOrder: z.number().int().min(0).max(100000),
})

export const taxonomyTagMutationSchema = z.object({
  name: z.string().trim().min(1).max(50),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

export type TaxonomyCategory = z.infer<typeof taxonomyCategorySchema>
export type TaxonomyTag = z.infer<typeof taxonomyTagSchema>
export type TaxonomyOptions = z.infer<typeof taxonomyOptionsSchema>
export type TaxonomyAssignment = z.infer<typeof taxonomyAssignmentSchema>
export type TaxonomyMutationValues = z.infer<typeof taxonomyMutationSchema>
export type TaxonomyTagMutationValues = z.infer<typeof taxonomyTagMutationSchema>
