import { z } from "zod"

const setPasswordResponseSchema = z.object({
  ok: z.literal(true),
})

export type SetPasswordResponse = z.infer<typeof setPasswordResponseSchema>

/**
 * Placeholder until the invite token endpoint is wired to the .NET API.
 * Validates a successful shape so the page already follows the Zod seam.
 */
export async function submitInvitePassword(input: {
  token: string
  password: string
}): Promise<SetPasswordResponse> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 900)
  })

  if (input.token.trim().length === 0 || input.password.length < 8) {
    throw new Error("INVALID_INVITE")
  }

  return setPasswordResponseSchema.parse({ ok: true })
}
