import { z } from "zod"

import {
  assetFamilyFieldSchema,
  guidLikeIdSchema,
} from "@/features/assets/schemas/assetFamilySchemas"
import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

/**
 * Tenant resource types. Quadra and Caçamba stay seeded (key quadra / cacamba).
 * GET /api/rentals/resource-types
 * POST /api/rentals/resource-types
 * PUT /api/rentals/resource-types/:id
 */
const fieldSchema = assetFamilyFieldSchema.extend({
  name: z.string().nullish(),
  visibility: z.enum(["public", "internal"]).nullish(),
  filterable: z.boolean().nullish(),
  askOnBooking: z.boolean().nullish(),
  options: z.array(z.string()).nullish(),
  responseType: z.string().nullish(),
})

export const resourceTypeRecordSchema = z.object({
  id: guidLikeIdSchema,
  key: z.string().min(1),
  name: z.string().min(1),
  singular: z.string().nullish(),
  plural: z.string().nullish(),
  article: z.enum(["um", "uma"]).nullish(),
  seeded: z.boolean().nullish(),
  resourceCount: z.number().int().nonnegative().nullish(),
  capabilities: z.object({
    bookable: z.boolean().nullish(),
    deliverable: z.boolean().nullish(),
    maintenance: z.boolean().nullish(),
  }).nullish(),
  bookable: z.boolean().nullish(),
  deliverable: z.boolean().nullish(),
  maintenance: z.boolean().nullish(),
  fields: z.array(fieldSchema).nullish().transform((fields) => fields ?? []),
})

export type ResourceTypeRecord = z.infer<typeof resourceTypeRecordSchema>

export type ResourceTypeWrite = {
  key?: string
  name: string
  singular: string
  plural: string
  article: "um" | "uma"
  capabilities: { bookable: boolean; deliverable: boolean; maintenance: boolean }
  fields: ResourceTypeRecord["fields"]
}

function throwTypeError(error: unknown, fallback: string): never {
  throw new Error(parseApiError(getAxiosErrorPayload(error), fallback), { cause: error })
}

export async function listResourceTypes(): Promise<ResourceTypeRecord[]> {
  try {
    const response = await api.get<unknown>("/api/rentals/resource-types")
    return z.array(resourceTypeRecordSchema).parse(response.data)
  } catch (error: unknown) {
    throwTypeError(error, i18n.t("assets.resourceTypes.errors.load"))
  }
}

export async function getResourceType(id: string): Promise<ResourceTypeRecord> {
  try {
    const response = await api.get<unknown>(`/api/rentals/resource-types/${id}`)
    return resourceTypeRecordSchema.parse(response.data)
  } catch (error: unknown) {
    throwTypeError(error, i18n.t("assets.resourceTypes.errors.load"))
  }
}

export async function createResourceType(body: ResourceTypeWrite): Promise<ResourceTypeRecord> {
  try {
    const response = await api.post<unknown>("/api/rentals/resource-types", body)
    return resourceTypeRecordSchema.parse(response.data)
  } catch (error: unknown) {
    throwTypeError(error, i18n.t("assets.resourceTypes.errors.save"))
  }
}

export async function updateResourceType(id: string, body: ResourceTypeWrite): Promise<ResourceTypeRecord> {
  try {
    const response = await api.put<unknown>(`/api/rentals/resource-types/${id}`, body)
    return resourceTypeRecordSchema.parse(response.data)
  } catch (error: unknown) {
    throwTypeError(error, i18n.t("assets.resourceTypes.errors.save"))
  }
}
