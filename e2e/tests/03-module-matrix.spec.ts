import fs from "node:fs"

import { test, expect } from "@playwright/test"

import { adminClient, b2bClient } from "../clients"
import { commercialPowerSet, readSnapshot, writeJson } from "../context"
import { CACHE_DIR } from "../env"
import { assertRuntimeGates } from "../gates"
import {
  applyCommercialModules,
  assertExactCommercial,
  MATRIX_FAMILIES,
  restoreTenant,
  updateAdminTenant,
} from "../tenant"
import path from "node:path"

const SEEN_PATH = path.join(CACHE_DIR, "matrix-seen.json")
const CHUNK_SIZE = 8

function comboKey(modules: readonly string[]): string {
  return [...modules].sort().join("|") || "(empty)"
}

async function exerciseCombination(
  modules: readonly string[],
): Promise<string> {
  const admin = adminClient()
  const b2b = b2bClient()
  const snapshot = readSnapshot()
  const key = comboKey(modules)

  if (modules.length === 0) {
    const before = await admin.get<{
      activeModules: Array<{ moduleName: string; isActive: boolean }>
    }>(`/api/admin/tenants/${snapshot.id}`)
    const result = await updateAdminTenant(
      admin,
      snapshot,
      snapshot.id,
      [],
      MATRIX_FAMILIES,
    )
    expect(result.status, result.text.slice(0, 240)).toBe(400)
    expect(result.text).toMatch(/at least one active module/i)
    const after = await admin.get<{
      activeModules: Array<{ moduleName: string; isActive: boolean }>
    }>(`/api/admin/tenants/${snapshot.id}`)
    expect(after.status).toBe(200)
    expect(
      (after.body?.activeModules ?? [])
        .filter((module) => module.isActive)
        .map((module) => module.moduleName)
        .sort(),
    ).toEqual(
      (before.body?.activeModules ?? [])
        .filter((module) => module.isActive)
        .map((module) => module.moduleName)
        .sort(),
    )
    return key
  }

  await applyCommercialModules(admin, snapshot, modules, MATRIX_FAMILIES)
  const reloaded = await admin.get(`/api/admin/tenants/${snapshot.id}`)
  expect(reloaded.status).toBe(200)
  assertExactCommercial(reloaded.body!, modules, {
    allowLegacyMaintenance: snapshot.hasLegacyMaintenance,
  })

  if (
    (modules.includes("rentals") ||
      modules.includes("pmoc") ||
      modules.includes("os")) &&
    !modules.includes("inventory")
  ) {
    expect(modules.includes("inventory")).toBe(false)
  }

  await assertRuntimeGates(b2b, modules)
  return key
}

test.describe("commercial entitlement matrix", () => {
  test.describe.configure({ mode: "serial" })

  test.beforeAll(() => {
    writeJson(SEEN_PATH, [])
  })

  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  const combinations = commercialPowerSet()
  const chunks: string[][][] = []
  for (let index = 0; index < combinations.length; index += CHUNK_SIZE) {
    chunks.push(combinations.slice(index, index + CHUNK_SIZE))
  }

  for (const [chunkIndex, chunk] of chunks.entries()) {
    test(`chunk ${chunkIndex + 1}/${chunks.length}: ${chunk.length} combinations`, async () => {
      test.setTimeout(4 * 60 * 1000)
      const seen: string[] = fs.existsSync(SEEN_PATH)
        ? (JSON.parse(fs.readFileSync(SEEN_PATH, "utf8")) as string[])
        : []

      for (const modules of chunk) {
        seen.push(await exerciseCombination(modules))
      }

      writeJson(SEEN_PATH, seen)
    })
  }

  test("all 32 commercial combinations were exercised", () => {
    expect(combinations).toHaveLength(32)
    const seen = JSON.parse(fs.readFileSync(SEEN_PATH, "utf8")) as string[]
    expect(new Set(seen).size).toBe(32)
  })
})

test.describe("sibling module isolation", () => {
  test.afterAll(async () => {
    await restoreTenant(adminClient(), readSnapshot())
  })

  test("sibling isolation: inventory ON does not authorize rentals/pmoc/os/catalog", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["inventory"], MATRIX_FAMILIES)
    await assertRuntimeGates(b2b, ["inventory"])
  })

  test("sibling isolation: rentals ON does not authorize inventory or catalog", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["rentals"], MATRIX_FAMILIES)
    await assertRuntimeGates(b2b, ["rentals"])
  })

  test("sibling isolation: catalog ON does not authorize rentals", async () => {
    const admin = adminClient()
    const b2b = b2bClient()
    const snapshot = readSnapshot()
    await applyCommercialModules(admin, snapshot, ["catalog"], MATRIX_FAMILIES)
    await assertRuntimeGates(b2b, ["catalog"])
  })
})
