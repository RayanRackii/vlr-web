import { z } from "zod"

export const rentalsReadinessItemSchema = z.object({
  key: z.enum([
    "hasUnits",
    "hasRentableAssets",
    "hasScheduleTemplateOrRule",
    "hasBookingPolicy",
    "hasVisualOrMap",
  ]),
  done: z.boolean(),
  count: z.number().int().nonnegative().optional(),
})

export const rentalsReadinessSchema = z.object({
  ready: z.boolean(),
  items: z.array(rentalsReadinessItemSchema),
})

export type RentalsReadiness = z.infer<typeof rentalsReadinessSchema>
export type RentalsReadinessItem = z.infer<typeof rentalsReadinessItemSchema>
