import { describe, expect, it, vi } from "vitest"

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock("@/lib/api", () => ({
  api: { post },
  getAxiosErrorPayload: vi.fn(),
  parseApiError: vi.fn(() => "Request failed"),
  publicApi: {},
}))

import { saveVisualTemplate } from "@/features/rentals/services/resourceVisualService"

describe("saveVisualTemplate", () => {
  it("uses the PlatformAdmin global-template endpoint", async () => {
    post.mockRejectedValueOnce(new Error("unavailable"))

    await expect(saveVisualTemplate({ slug: "global" })).rejects.toThrow()

    expect(post).toHaveBeenCalledWith(
      "/api/admin/resource-visual-templates",
      { slug: "global" },
    )
  })
})
