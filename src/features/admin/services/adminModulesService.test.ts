import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
  getAxiosErrorPayload: vi.fn(),
  isAxiosError: vi.fn(() => false),
  parseApiError: vi.fn((_payload: unknown, fallback: string) => fallback),
}))

const rentalsOnly = [
  {
    key: "rentals",
    isCommercial: true,
    isLegacy: false,
    provides: [],
    requiredCapabilities: ["asset-registry"],
    aliases: ["aluguel"],
  },
]

const fiveCommercial = [
  {
    key: "inventory",
    isCommercial: true,
    isLegacy: false,
    provides: ["asset-registry"],
    requiredCapabilities: [],
    aliases: ["inventario"],
  },
  {
    key: "pmoc",
    isCommercial: true,
    isLegacy: false,
    provides: [],
    requiredCapabilities: ["asset-registry"],
    aliases: [],
  },
  {
    key: "os",
    isCommercial: true,
    isLegacy: false,
    provides: [],
    requiredCapabilities: ["asset-registry"],
    aliases: ["workorders"],
  },
  {
    key: "rentals",
    isCommercial: true,
    isLegacy: false,
    provides: [],
    requiredCapabilities: ["asset-registry"],
    aliases: [],
  },
  {
    key: "catalog",
    isCommercial: true,
    isLegacy: false,
    provides: [],
    requiredCapabilities: [],
    aliases: ["orders"],
  },
]

const apiGet = vi.mocked(api.get)

describe("listAdminModules", () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  it("GETs /api/admin/modules and parses the catalog DTO", async () => {
    apiGet.mockResolvedValue({ data: fiveCommercial })
    const { listAdminModules } = await import(
      "@/features/admin/services/adminModulesService"
    )

    const result = await listAdminModules()

    expect(apiGet).toHaveBeenCalledWith("/api/admin/modules")
    expect(result).toEqual(fiveCommercial)
  })

  it("does not invent inventory when the payload only contains rentals", async () => {
    apiGet.mockResolvedValue({ data: rentalsOnly })
    const { listAdminModules } = await import(
      "@/features/admin/services/adminModulesService"
    )

    const result = await listAdminModules()

    expect(result.map((item) => item.key)).toEqual(["rentals"])
    expect(result.some((item) => item.key === "inventory")).toBe(false)
  })
})

describe("selectableCommercialModules", () => {
  it("keeps commercial non-legacy keys and drops asset-registry and maintenance", async () => {
    const { selectableCommercialModules } = await import(
      "@/features/admin/services/adminModulesService"
    )

    const selected = selectableCommercialModules([
      ...rentalsOnly,
      {
        key: "asset-registry",
        isCommercial: true,
        isLegacy: false,
        provides: [],
        requiredCapabilities: [],
        aliases: [],
      },
      {
        key: "maintenance",
        isCommercial: false,
        isLegacy: true,
        provides: [],
        requiredCapabilities: [],
        aliases: [],
      },
      {
        key: "maintenance",
        isCommercial: true,
        isLegacy: false,
        provides: [],
        requiredCapabilities: [],
        aliases: [],
      },
    ])

    expect(selected.map((item) => item.key)).toEqual(["rentals"])
  })
})
