import { afterEach, describe, expect, it, vi } from "vitest"

import {
  currentUserSessionFingerprint,
  invalidateCurrentUserCache,
  peekCurrentUserCacheForTests,
  readCurrentUser,
  resetCurrentUserCacheForTests,
  syncCurrentUserCacheToAuthUser,
} from "@/features/users/services/currentUserCache"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"

const adminA: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Admin A",
  email: "admin-a@example.com",
  role: "ADMIN",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: ["catalog"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: ["core.notifications.read"],
}

const adminB: CurrentUser = {
  ...adminA,
  id: "33333333-3333-4333-8333-333333333333",
  email: "admin-b@example.com",
  fullName: "Admin B",
}

afterEach(() => {
  resetCurrentUserCacheForTests()
})

describe("currentUserSessionFingerprint", () => {
  it("changes when the user id or JWT tenant changes", () => {
    expect(
      currentUserSessionFingerprint({ id: "user-a", app_metadata: {} }),
    ).toBe("user-a|")
    expect(
      currentUserSessionFingerprint({
        id: "user-a",
        app_metadata: { tenant_id: "tenant-1" },
      }),
    ).toBe("user-a|tenant-1")
    expect(
      currentUserSessionFingerprint({
        id: "user-b",
        app_metadata: { tenant_id: "tenant-1" },
      }),
    ).toBe("user-b|tenant-1")
  })
})

describe("readCurrentUser cache", () => {
  it("A: 7 concurrent callers share one loader invocation", async () => {
    const loader = vi.fn(async () => adminA)
    const results = await Promise.all(
      Array.from({ length: 7 }, () => readCurrentUser(loader)),
    )

    expect(loader).toHaveBeenCalledTimes(1)
    expect(results).toHaveLength(7)
    expect(new Set(results.map((item) => item.email)).size).toBe(1)
    expect(results[0]).toBe(results[6])
  })

  it("B: later callers receive the same cached profile without a second load", async () => {
    const loader = vi.fn(async () => adminA)
    const first = await readCurrentUser(loader)
    const second = await readCurrentUser(loader)

    expect(loader).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
    expect(peekCurrentUserCacheForTests()).toBe(adminA)
  })

  it("C: a failed load does not poison the cache and the next call retries", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(adminA)

    await expect(readCurrentUser(loader)).rejects.toThrow("network")
    expect(peekCurrentUserCacheForTests()).toBeNull()

    await expect(readCurrentUser(loader)).resolves.toEqual(adminA)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it("D: logout invalidation drops the cached profile", async () => {
    const loader = vi.fn(async () => adminA)
    syncCurrentUserCacheToAuthUser({ id: "user-a", app_metadata: {} })
    await readCurrentUser(loader)
    syncCurrentUserCacheToAuthUser(null)
    expect(peekCurrentUserCacheForTests()).toBeNull()

    loader.mockResolvedValueOnce(adminB)
    const next = await readCurrentUser(loader)
    expect(next.email).toBe("admin-b@example.com")
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it("E: tenant enter/exit fingerprint change invalidates the cache", async () => {
    const loader = vi.fn(async () => adminA)
    syncCurrentUserCacheToAuthUser({ id: "user-a", app_metadata: {} })
    await readCurrentUser(loader)

    syncCurrentUserCacheToAuthUser({
      id: "user-a",
      app_metadata: { tenant_id: "tenant-1" },
    })
    expect(peekCurrentUserCacheForTests()).toBeNull()

    await readCurrentUser(loader)
    expect(loader).toHaveBeenCalledTimes(2)

    syncCurrentUserCacheToAuthUser({ id: "user-a", app_metadata: {} })
    expect(peekCurrentUserCacheForTests()).toBeNull()
    await readCurrentUser(loader)
    expect(loader).toHaveBeenCalledTimes(3)
  })

  it("does not invalidate on a repeated fingerprint (token refresh)", async () => {
    const loader = vi.fn(async () => adminA)
    const user = {
      id: "user-a",
      app_metadata: { tenant_id: "tenant-1" },
    }
    syncCurrentUserCacheToAuthUser(user)
    await readCurrentUser(loader)
    syncCurrentUserCacheToAuthUser(user)
    await readCurrentUser(loader)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("F: a stale in-flight failure does not overwrite a newer success", async () => {
    let rejectFirst!: (reason: Error) => void
    let resolveSecond!: (value: CurrentUser) => void

    const loader = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<CurrentUser>((_resolve, reject) => {
            rejectFirst = reject
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<CurrentUser>((resolve) => {
            resolveSecond = resolve
          }),
      )

    const first = readCurrentUser(loader)
    invalidateCurrentUserCache()
    const second = readCurrentUser(loader)

    resolveSecond(adminA)
    await expect(second).resolves.toEqual(adminA)

    rejectFirst(new Error("network"))
    await expect(first).resolves.toEqual(adminA)
    expect(peekCurrentUserCacheForTests()).toEqual(adminA)
  })
})
