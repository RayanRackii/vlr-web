import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { describe, expect, it } from "vitest"

import {
  isPlanLimitError,
  readPlanLimit,
  toPlanLimitError,
} from "@/features/billing/lib/planLimitError"
import i18n from "@/lib/i18n"

function httpError(status: number, data: unknown): AxiosError {
  return new AxiosError("fail", undefined, undefined, undefined, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

const body = {
  error: "Plan limit reached.",
  code: "plan.limit_reached",
  limit: "rentable_resources",
  current: 3,
  max: 3,
  planKey: "essencial",
}

describe("plan limit error mapping", () => {
  it("reads the 409 body and ignores other codes", () => {
    expect(readPlanLimit(body)).toEqual({
      limit: "rentable_resources",
      current: 3,
      max: 3,
      planKey: "essencial",
    })
    expect(readPlanLimit({ code: "other", error: "x" })).toBeNull()
    expect(readPlanLimit(null)).toBeNull()
    expect(readPlanLimit({ code: "plan.limit_reached" })).toEqual({
      limit: null,
      current: null,
      max: null,
      planKey: null,
    })
  })

  it("turns a 409 plan.limit_reached into a localized PlanLimitError", async () => {
    const error = toPlanLimitError(httpError(409, body))
    expect(isPlanLimitError(error)).toBe(true)
    expect(error?.message).toBe("Limite do plano atingido — ver planos")
    expect(error?.details.limit).toBe("rentable_resources")

    await i18n.changeLanguage("en")
    expect(toPlanLimitError(httpError(409, body))?.message).toBe("Plan limit reached — see plans")
    await i18n.changeLanguage("pt-BR")
  })

  it("does not touch other errors", () => {
    expect(toPlanLimitError(httpError(409, { error: "Tag already exists." }))).toBeNull()
    expect(toPlanLimitError(httpError(400, body))).toBeNull()
    expect(toPlanLimitError(new Error("x"))).toBeNull()
  })
})
