import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api, publicApi } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    publicApi: {
      post: vi.fn(),
    },
    api: {
      post: vi.fn(),
      get: vi.fn(),
    },
  }
})

import {
  EXISTING_ACCOUNT_SIGN_IN_REQUIRED,
  INVITE_ACCOUNT_MISMATCH,
  INVITE_IDENTITY_CONFLICT,
  acceptExistingAccountInvite,
  acceptNewAccountInvite,
  previewInvite,
} from "@/features/auth/inviteAcceptService"

const publicPost = vi.mocked(publicApi.post)
const staffPost = vi.mocked(api.post)

const preview = {
  email: "ana@club.test",
  fullName: "Ana",
  tenantId: "22222222-2222-4222-8222-222222222222",
  tenantName: "Clube Norte",
  existingAccount: false,
  expiresAt: "2026-10-20T12:00:00+00:00",
}

const accepted = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: preview.tenantId,
  email: preview.email,
  existingAccount: false,
}

function apiError(status: number, code: string): AxiosError {
  return new AxiosError(code, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data: { error: code },
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("invite accept contract", () => {
  beforeEach(() => {
    publicPost.mockReset()
    staffPost.mockReset()
  })

  it("previews a token anonymously", async () => {
    publicPost.mockResolvedValue({ data: preview })

    await expect(previewInvite("invite-token")).resolves.toEqual(preview)
    expect(publicPost).toHaveBeenCalledWith("/api/invites/preview", {
      token: "invite-token",
    })
    expect(staffPost).not.toHaveBeenCalled()
  })

  it("accepts a new account with a password and no staff client", async () => {
    publicPost.mockResolvedValue({ data: accepted })

    await expect(
      acceptNewAccountInvite({
        token: "invite-token",
        password: "password1",
      }),
    ).resolves.toEqual(accepted)

    expect(publicPost).toHaveBeenCalledWith("/api/invites/accept", {
      token: "invite-token",
      password: "password1",
    })
    expect(staffPost).not.toHaveBeenCalled()
  })

  it("accepts an existing account on the staff client without a password", async () => {
    staffPost.mockResolvedValue({
      data: { ...accepted, existingAccount: true },
    })

    await expect(
      acceptExistingAccountInvite({ token: "invite-token" }),
    ).resolves.toMatchObject({ existingAccount: true })

    expect(staffPost).toHaveBeenCalledWith("/api/invites/accept", {
      token: "invite-token",
    })
    expect(publicPost).not.toHaveBeenCalled()
  })

  it("maps 409 EXISTING_ACCOUNT_SIGN_IN_REQUIRED", async () => {
    publicPost.mockRejectedValue(
      apiError(409, EXISTING_ACCOUNT_SIGN_IN_REQUIRED),
    )

    await expect(
      acceptNewAccountInvite({ token: "invite-token", password: "password1" }),
    ).rejects.toMatchObject({
      name: "InviteAcceptError",
      code: EXISTING_ACCOUNT_SIGN_IN_REQUIRED,
      status: 409,
    })
  })

  it("maps 403 INVITE_ACCOUNT_MISMATCH from the staff client", async () => {
    staffPost.mockRejectedValue(apiError(403, INVITE_ACCOUNT_MISMATCH))

    await expect(
      acceptExistingAccountInvite({ token: "invite-token" }),
    ).rejects.toMatchObject({
      name: "InviteAcceptError",
      code: INVITE_ACCOUNT_MISMATCH,
      status: 403,
    })
  })

  it("maps 409 INVITE_IDENTITY_CONFLICT", async () => {
    staffPost.mockRejectedValue(apiError(409, INVITE_IDENTITY_CONFLICT))

    await expect(
      acceptExistingAccountInvite({ token: "invite-token" }),
    ).rejects.toMatchObject({
      code: INVITE_IDENTITY_CONFLICT,
      status: 409,
    })
  })

  it("rejects a preview body that does not match the contract", async () => {
    publicPost.mockResolvedValue({ data: { email: "ana@club.test" } })

    await expect(previewInvite("invite-token")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: null,
    })
  })
})
