import { z } from "zod"

export const bookingIdleTimeoutMinutesSchema = z.number().int().min(1).max(120)
export const bookingIdleRedirectPathSchema = z.string().max(200).refine((value) =>
  !Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f)
  }),
).regex(/^\/(?!\/)[^\\\s]*$/)
