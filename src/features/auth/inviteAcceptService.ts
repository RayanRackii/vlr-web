import {
  api,
  getAxiosErrorPayload,
  isAxiosError,
  parseApiError,
  publicApi,
} from "@/lib/api"
import {
  acceptInviteResponseSchema,
  invitePreviewSchema,
  type AcceptInviteResponse,
  type InvitePreview,
} from "@/features/auth/inviteSchemas"

export const EXISTING_ACCOUNT_SIGN_IN_REQUIRED =
  "EXISTING_ACCOUNT_SIGN_IN_REQUIRED"
export const INVITE_ACCOUNT_MISMATCH = "INVITE_ACCOUNT_MISMATCH"
export const INVITE_IDENTITY_CONFLICT = "INVITE_IDENTITY_CONFLICT"

export class InviteAcceptError extends Error {
  readonly code: string
  readonly status: number | null

  constructor(code: string, status: number | null) {
    super(code)
    this.name = "InviteAcceptError"
    this.code = code
    this.status = status
  }
}

function asInviteAcceptError(error: unknown): InviteAcceptError {
  if (error instanceof InviteAcceptError) {
    return error
  }

  const status = isAxiosError(error) ? (error.response?.status ?? null) : null
  const code = parseApiError(getAxiosErrorPayload(error), "INVALID_INVITE")
  return new InviteAcceptError(code, status)
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  try {
    const response = await publicApi.post<unknown>("/api/invites/preview", {
      token,
    })
    const parsed = invitePreviewSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new InviteAcceptError("INVALID_RESPONSE", null)
    }

    return parsed.data
  } catch (error: unknown) {
    throw asInviteAcceptError(error)
  }
}

/** New email: anonymous accept creates the Auth user and the membership. */
export async function acceptNewAccountInvite(input: {
  token: string
  password: string
}): Promise<AcceptInviteResponse> {
  try {
    const response = await publicApi.post<unknown>("/api/invites/accept", {
      token: input.token,
      password: input.password,
    })
    return readAcceptResponse(response.data)
  } catch (error: unknown) {
    throw asInviteAcceptError(error)
  }
}

/**
 * Existing email: staff client attaches the signed-in user's bearer token.
 * The password is never sent. The API ignores a password on this path.
 */
export async function acceptExistingAccountInvite(input: {
  token: string
}): Promise<AcceptInviteResponse> {
  try {
    const response = await api.post<unknown>("/api/invites/accept", {
      token: input.token,
    })
    return readAcceptResponse(response.data)
  } catch (error: unknown) {
    throw asInviteAcceptError(error)
  }
}

function readAcceptResponse(data: unknown): AcceptInviteResponse {
  const parsed = acceptInviteResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new InviteAcceptError("INVALID_RESPONSE", null)
  }

  return parsed.data
}
