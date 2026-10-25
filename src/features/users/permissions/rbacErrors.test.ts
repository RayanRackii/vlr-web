import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { afterEach, describe, expect, it } from "vitest"

import { describeApiError } from "@/features/users/permissions/rbacErrors"
import i18n from "@/lib/i18n"

function forbiddenError(payload: unknown): AxiosError {
  return new AxiosError("forbidden", undefined, undefined, undefined, {
    status: 403,
    statusText: "Forbidden",
    data: payload,
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("module inactive API errors", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it.each([
    { error: "Module is not active for this tenant" },
    { error: "Module is not active for this tenant." },
    { error: "forbidden", code: "module_inactive" },
    { error: "forbidden", errorCode: "MODULE_INACTIVE" },
  ])("localizes module-inactive 403 payloads: %o", async (payload) => {
    await i18n.changeLanguage("en")
    expect(describeApiError(forbiddenError(payload), "fallback")).toBe(
      "This module is not active in this workspace.",
    )
  })
})
