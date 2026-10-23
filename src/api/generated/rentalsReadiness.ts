// generated from openapi/openapi.json; do not edit.
import type { AxiosInstance } from "axios"
import { z } from "zod"

export const rentalsReadinessItemSchema = z.object({
  count: z.number().int().nullable().optional(),
  done: z.boolean().optional(),
  key: z.string().nullable().optional(),
})

export const rentalsReadinessResponseSchema = z.object({
  items: z.array(rentalsReadinessItemSchema).nullable().optional(),
  ready: z.boolean().optional(),
})

export type RentalsReadinessResponse = z.infer<typeof rentalsReadinessResponseSchema>

export async function getRentalsReadinessResponse(client: AxiosInstance) {
  return client.get<unknown>("/api/rentals/readiness")
}
