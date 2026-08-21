import { z } from "zod"

import { publicApi, getAxiosErrorPayload, parseApiError } from "@/lib/api"

const setPasswordResponseSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string(),
})

export type SetPasswordResponse = z.infer<typeof setPasswordResponseSchema>

export async function submitInvitePassword(input: {
  token: string
  password: string
}): Promise<SetPasswordResponse> {
  try {
    const response = await publicApi.post<unknown>("/api/invites/accept", {
      token: input.token,
      password: input.password,
    })
    return setPasswordResponseSchema.parse(response.data)
  } catch (error: unknown) {
    const message = parseApiError(
      getAxiosErrorPayload(error),
      "INVALID_INVITE",
    )
    throw new Error(message)
  }
}
