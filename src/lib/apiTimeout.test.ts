import { AxiosError } from "axios"
import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import { api, customerApi, isRequestTimeoutError, publicApi } from "@/lib/api"
import { API_REQUEST_TIMEOUT_MS } from "@/lib/apiTimeouts"

describe("api request timeout", () => {
  it("sets the default timeout on all clients", () => {
    for (const client of [api, customerApi, publicApi]) {
      expect(client.defaults.timeout).toBe(API_REQUEST_TIMEOUT_MS)
    }
  })

  it("maps a timeout to the friendly text", async () => {
    const result = await api
      .get("/x", {
        adapter: () => Promise.reject(new AxiosError("timeout of 30000ms exceeded", AxiosError.ECONNABORTED)),
      })
      .catch((e: unknown) => e)
    expect(isRequestTimeoutError(result)).toBe(true)
    expect((result as AxiosError).message).toBe(i18n.t("apiErrors.timeout"))
  })
})
