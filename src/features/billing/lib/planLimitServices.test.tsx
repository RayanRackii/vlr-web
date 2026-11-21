import { render, screen } from "@testing-library/react"
import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PlanLimitNotice } from "@/features/billing/components/PlanLimitNotice"
import { isPlanLimitError } from "@/features/billing/lib/planLimitError"
import { createAsset } from "@/features/assets/services/assetsService"
import { createUnit } from "@/features/assets/services/unitsService"
import { inviteTenantMember } from "@/features/users/services/usersService"
import { api } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, api: { post: vi.fn(), get: vi.fn() } }
})

function limitReached(): AxiosError {
  return new AxiosError("conflict", undefined, undefined, undefined, {
    status: 409,
    statusText: "Conflict",
    data: {
      error: "Plan limit reached.",
      code: "plan.limit_reached",
      limit: "assets",
      current: 10,
      max: 10,
      planKey: "essencial",
    },
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

const ID = "11111111-1111-4111-8111-111111111111"

describe("plan.limit_reached mapping in the services that create things", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset().mockRejectedValue(limitReached())
  })

  it("maps an asset create refusal", async () => {
    const error = await createAsset({
      unitId: ID,
      categoryId: ID,
      familyId: ID,
      name: "Quadra 1",
      tag: "",
    } as Parameters<typeof createAsset>[0]).catch((caught: unknown) => caught)

    expect(isPlanLimitError(error)).toBe(true)
    expect((error as Error).message).toBe("Limite do plano atingido — ver planos")
  })

  it("maps a unit create refusal", async () => {
    const error = await createUnit({ name: "Filial" }).catch((caught: unknown) => caught)
    expect(isPlanLimitError(error)).toBe(true)
  })

  it("maps a user invite refusal", async () => {
    const error = await inviteTenantMember({
      fullName: "Ana Costa",
      email: "ana@clube.com",
      roleIds: [ID],
    }).catch((caught: unknown) => caught)
    expect(isPlanLimitError(error)).toBe(true)
  })
})

describe("PlanLimitNotice", () => {
  it("shows the message with a link to the plans page", () => {
    render(
      <MemoryRouter>
        <PlanLimitNotice />
      </MemoryRouter>,
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Limite do plano atingido — ver planos")
    expect(screen.getByRole("link", { name: "ver planos" })).toHaveAttribute("href", "/precos")
  })
})
