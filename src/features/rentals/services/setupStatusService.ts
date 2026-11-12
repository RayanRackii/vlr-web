import { z } from "zod"

import { api } from "@/lib/api"

const stateSchema = z.enum(["draft", "missing", "published"])

const setupStatusSchema = z.object({
  checklist: z.array(z.object({
    key: z.string(),
    state: stateSchema,
  })),
  resources: z.array(z.object({
    id: z.string().uuid(),
    state: stateSchema,
    missing: z.array(z.string()),
  })),
})

export type SetupStatus = z.infer<typeof setupStatusSchema>

export async function getSetupStatus(): Promise<SetupStatus> {
  const response = await api.get<unknown>("/api/rentals/setup-status")
  return setupStatusSchema.parse(response.data)
}
