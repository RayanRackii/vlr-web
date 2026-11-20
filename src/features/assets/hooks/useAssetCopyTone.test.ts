import { describe, expect, it } from "vitest"

import { resolveAssetCopyTone } from "@/features/assets/hooks/useAssetCopyTone"

describe("resolveAssetCopyTone", () => {
  it("keeps the family copy when exactly one family is enabled", () => {
    expect(resolveAssetCopyTone(["goods"])).toBe("goods")
    expect(resolveAssetCopyTone(["goods", "generic"])).toBe("goods")
    expect(resolveAssetCopyTone(["spaces"])).toBe("spaces")
    expect(resolveAssetCopyTone(["electrical"])).toBe("electrical")
  })

  it("uses neutral copy when more than one family is enabled", () => {
    expect(resolveAssetCopyTone(["goods", "printer_3d", "scanner_3d"])).toBe("generic")
    expect(resolveAssetCopyTone(["goods", "spaces"])).toBe("generic")
    expect(resolveAssetCopyTone(["electrical", "printer_3d"], ["inventory"])).toBe("generic")
  })
})
