import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { usePublicDocumentTitle } from "@/hooks/usePublicDocumentTitle"

describe("usePublicDocumentTitle", () => {
  it("sets '<page> · Rolvix' and restores the previous title on unmount", () => {
    document.title = "before"
    const { unmount } = renderHook(() => usePublicDocumentTitle("Preços"))
    expect(document.title).toBe("Preços · Rolvix")
    unmount()
    expect(document.title).toBe("before")
  })
})
