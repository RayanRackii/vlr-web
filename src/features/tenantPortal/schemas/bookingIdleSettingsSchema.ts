import { z } from "zod"

export const bookingIdleTimeoutMinutesSchema = z.number().int().min(1).max(120)
export const bookingIdleRedirectPathSchema = z.string().regex(/^\/(?!\/)[^\\\s]*$/)
