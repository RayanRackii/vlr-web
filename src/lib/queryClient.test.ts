import { AxiosError } from "axios"
import { describe, expect, it } from "vitest"
import { invalidateCurrentUserCache, syncCurrentUserCacheToAuthUser } from "@/features/users/services/currentUserCache"
import { notifyCustomerSessionChanged } from "@/lib/customerSessionEvents"
import { createQueryClient, queryClient, shouldRetryQuery } from "./queryClient"
import { tenantKey } from "./queryKeys"

const httpError = (status: number) => new AxiosError("x", "ERR_BAD_RESPONSE", undefined, undefined, { status } as never)

describe("query retry policy", () => {
  it.each([400, 401, 403, 404, 409, 422])("never retries a %s", (status) => {
    expect(shouldRetryQuery(0, httpError(status))).toBe(false)
  })
  it("retries a network error once", () => {
    const network = new AxiosError("Network Error", "ERR_NETWORK")
    expect(shouldRetryQuery(0, network)).toBe(true)
    expect(shouldRetryQuery(1, network)).toBe(false)
  })
  it("retries a 5xx once, also when a service wrapped it", () => {
    const wrapped = new Error("falhou", { cause: httpError(503) })
    expect(shouldRetryQuery(0, wrapped)).toBe(true)
    expect(shouldRetryQuery(1, wrapped)).toBe(false)
  })
  it("does not retry local errors (invalid payload) or a wrapped 4xx", () => {
    expect(shouldRetryQuery(0, new Error("invalid"))).toBe(false)
    expect(shouldRetryQuery(0, new Error("nope", { cause: httpError(404) }))).toBe(false)
  })
  it("sets the documented defaults", () => {
    const defaults = createQueryClient().getDefaultOptions()
    expect(defaults.queries).toMatchObject({ staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: true })
    expect(defaults.mutations?.retry).toBe(0)
  })
})

describe("tenant isolation of the query cache", () => {
  it("prefixes every key with the tenant", () => {
    expect(tenantKey("t1", "orders", 3)).toEqual(["tenant", "t1", "orders", 3])
    expect(tenantKey(null, "orders")).toEqual(["tenant", "none", "orders"])
    expect(tenantKey("t1", "x")).not.toEqual(tenantKey("t2", "x"))
  })

  it("never returns cached data of another tenant key", () => {
    queryClient.setQueryData(tenantKey("t1", "orders"), ["secret"])
    expect(queryClient.getQueryData(tenantKey("t2", "orders"))).toBeUndefined()
    queryClient.clear()
  })

  it("clears the cache on tenant enter/exit/switch (session refresh)", () => {
    queryClient.setQueryData(tenantKey("t1", "orders"), ["secret"])
    invalidateCurrentUserCache()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it("clears the cache when the identity or tenant of the auth user changes, and on logout", () => {
    const user = (tenant: string) => ({ id: "u1", app_metadata: { tenant_id: tenant } })
    syncCurrentUserCacheToAuthUser(user("t1"))
    queryClient.setQueryData(tenantKey("t1", "orders"), ["secret"])
    syncCurrentUserCacheToAuthUser(user("t1")) // token refresh: same fingerprint keeps the cache
    expect(queryClient.getQueryData(tenantKey("t1", "orders"))).toEqual(["secret"])
    syncCurrentUserCacheToAuthUser(user("t2"))
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    queryClient.setQueryData(tenantKey("t2", "orders"), ["secret"])
    syncCurrentUserCacheToAuthUser(null)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it("clears the cache when the customer portal session changes", () => {
    queryClient.setQueryData(tenantKey("t1", "orders"), ["secret"])
    notifyCustomerSessionChanged()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})
