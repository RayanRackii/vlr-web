import { describe, expect, it } from "vitest"

import appRoutesSource from "@/routes/AppRoutes.tsx?raw"

describe("AppRoutes PMOC static paths", () => {
  it("declares static PMOC routes before /pmoc/:id", () => {
    const paths = [...appRoutesSource.matchAll(/path="(\/pmoc[^"]*)"/g)].map(
      (match) => match[1],
    )

    expect(paths).toEqual([
      "/pmoc",
      "/pmoc/biblioteca",
      "/pmoc/biblioteca/:templateId",
      "/pmoc/novo",
      "/pmoc/:id",
    ])

    expect(paths.indexOf("/pmoc/biblioteca")).toBeLessThan(
      paths.indexOf("/pmoc/:id"),
    )
    expect(paths.indexOf("/pmoc/biblioteca/:templateId")).toBeLessThan(
      paths.indexOf("/pmoc/:id"),
    )
    expect(paths.indexOf("/pmoc/novo")).toBeLessThan(paths.indexOf("/pmoc/:id"))
  })
})
