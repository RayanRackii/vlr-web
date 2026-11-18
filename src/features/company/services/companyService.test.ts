import { afterEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { getCompanyProfile, updateCompanyProfile } from "@/features/company/services/companyService"

afterEach(() => { vi.restoreAllMocks() })

describe("companyService", () => {
  it("GETs /api/company and normalises nulls", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: { legalName: "X", tradeName: null, address: null, subdomain: "x" } })
    const profile = await getCompanyProfile()
    expect(get).toHaveBeenCalledWith("/api/company")
    expect(profile.tradeName).toBe("")
    expect(profile.address.city).toBe("")
  })

  it("PUTs the body to /api/company", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: { legalName: "Y" } })
    const body = { legalName: "Y", tradeName: null, taxId: null, contactEmail: null, contactPhone: null, address: { postalCode: null, street: null, number: null, complement: null, district: null, city: null, state: null } }
    const profile = await updateCompanyProfile(body)
    expect(put).toHaveBeenCalledWith("/api/company", body)
    expect(profile.legalName).toBe("Y")
  })

  it("rejects when the request fails", async () => {
    vi.spyOn(api, "put").mockRejectedValue(new Error("boom"))
    await expect(updateCompanyProfile({ legalName: "Y" } as never)).rejects.toThrow()
  })
})
