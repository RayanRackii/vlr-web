import { test, expect } from "@playwright/test"

import { adminClient, b2bClient } from "../clients"
import { deleteE2eOwnedResources, restoreSnapshotExact } from "../cleanup"
import { readSnapshot } from "../context"

test.describe("restoration", () => {
  test("original tenant state is restored", async () => {
    const snapshot = readSnapshot()
    const admin = adminClient()
    const b2b = b2bClient()
    await deleteE2eOwnedResources(admin, b2b, snapshot)
    const restored = await restoreSnapshotExact(admin, snapshot)
    expect(restored.match, restored.detail).toBe(true)
    expect(restored.detail).toBe("RESTORE_MATCH: YES")
  })
})
