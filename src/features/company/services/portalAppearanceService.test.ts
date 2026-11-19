import { afterEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import {
  deletePortalLandingImage,
  getPortalAppearance,
  updatePortalAppearance,
  uploadPortalLandingImage,
} from "@/features/company/services/portalAppearanceService"

afterEach(() => { vi.restoreAllMocks() })

describe("portalAppearanceService", () => {
  it("GETs /api/portal-appearance and normalises nulls", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: { landingImageUrl: null, landingKicker: null, welcomeTagline: "Oi" } })
    const result = await getPortalAppearance()
    expect(get).toHaveBeenCalledWith("/api/portal-appearance")
    expect(result).toEqual({ landingImageUrl: null, landingKicker: "", landingHeadline: "", landingSubtitle: "", welcomeTagline: "Oi" })
  })

  it("PUTs all three texts (full replace)", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: { landingKicker: "K" } })
    const body = { landingKicker: "K", landingHeadline: null, landingSubtitle: null }
    await updatePortalAppearance(body)
    expect(put).toHaveBeenCalledWith("/api/portal-appearance", body)
  })

  it("POSTs the file as multipart and reports progress", async () => {
    const post = vi.spyOn(api, "post").mockImplementation(async (_url, _data, config) => {
      ;(config as { onUploadProgress?: (e: { loaded: number; total?: number }) => void }).onUploadProgress?.({ loaded: 50, total: 200 })
      return { data: { landingImageUrl: "https://cdn/x.jpg" } }
    })
    const onProgress = vi.fn()
    const file = new File(["a"], "a.jpg", { type: "image/jpeg" })
    const result = await uploadPortalLandingImage(file, onProgress)
    const [url, data] = post.mock.calls[0] as unknown as [string, FormData]
    expect(url).toBe("/api/portal-appearance/landing-image")
    expect(data.get("file")).toBe(file)
    expect(onProgress).toHaveBeenCalledWith(25)
    expect(result.landingImageUrl).toBe("https://cdn/x.jpg")
  })

  it("DELETEs the landing image", async () => {
    const del = vi.spyOn(api, "delete").mockResolvedValue({ data: { landingImageUrl: null } })
    expect((await deletePortalLandingImage()).landingImageUrl).toBeNull()
    expect(del).toHaveBeenCalledWith("/api/portal-appearance/landing-image")
  })

  it("rejects with the original error as cause", async () => {
    const boom = new Error("boom")
    vi.spyOn(api, "put").mockRejectedValue(boom)
    await expect(updatePortalAppearance({ landingKicker: null, landingHeadline: null, landingSubtitle: null })).rejects.toMatchObject({ cause: boom })
  })
})
