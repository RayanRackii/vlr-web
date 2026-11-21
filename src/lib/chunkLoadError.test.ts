import { beforeEach, describe, expect, it, vi } from "vitest"

import * as chunk from "@/lib/chunkLoadError"
import { reloadPage } from "@/lib/reloadPage"

vi.mock("@/lib/reloadPage", () => ({ reloadPage: vi.fn() }))

describe("chunkLoadError", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.mocked(reloadPage).mockClear()
  })

  it("recognises the browser messages for a missing chunk", () => {
    expect(chunk.isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /a.js"))).toBe(true)
    expect(chunk.isChunkLoadError(new TypeError("error loading dynamically imported module"))).toBe(true)
    expect(chunk.isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true)
    expect(chunk.isChunkLoadError(new Error("Loading chunk 12 failed."))).toBe(true)
    expect(chunk.isChunkLoadError(Object.assign(new Error("x"), { name: "ChunkLoadError" }))).toBe(true)
  })

  it("ignores unrelated errors", () => {
    expect(chunk.isChunkLoadError(new Error("boom"))).toBe(false)
    expect(chunk.isChunkLoadError("Failed to fetch dynamically imported module")).toBe(false)
  })

  it("reloads once per window and then refuses", () => {
    expect(chunk.reloadOnceForChunkError(1_000_000)).toBe(true)
    expect(chunk.reloadOnceForChunkError(1_005_000)).toBe(false)
    expect(reloadPage).toHaveBeenCalledTimes(1)
    expect(chunk.reloadOnceForChunkError(1_040_000)).toBe(true)
    expect(reloadPage).toHaveBeenCalledTimes(2)
  })
})
