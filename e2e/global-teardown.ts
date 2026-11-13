import { adminClient, b2bClient } from "./clients"
import { deleteE2eOwnedResources, restoreSnapshotExact } from "./cleanup"
import { readSnapshot } from "./context"
import { writeJson } from "./context"
import { CACHE_DIR, SNAPSHOT_PATH } from "./env"
import fs from "node:fs"
import path from "node:path"

export default async function globalTeardown(): Promise<void> {
  // globalSetup failed before snapshotting the tenant, so it changed nothing: skip restore
  // instead of throwing ENOENT on top of the real setup error.
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.warn("E2E teardown skipped: no tenant snapshot (globalSetup did not finish).")
    return
  }
  const snapshot = readSnapshot()
  const admin = adminClient()
  const b2b = b2bClient()

  try {
    await deleteE2eOwnedResources(admin, b2b, snapshot)
    const restored = await restoreSnapshotExact(admin, b2b, snapshot)
    writeJson(path.join(CACHE_DIR, "restore-result.json"), restored)
    if (!restored.match) {
      throw new Error(`E2E_CLEANUP_FAILED ${restored.detail}`)
    }
  } catch (error) {
    writeJson(path.join(CACHE_DIR, "restore-result.json"), {
      match: false,
      detail: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
