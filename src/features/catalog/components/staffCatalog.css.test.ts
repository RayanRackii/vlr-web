import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync("src/features/catalog/components/staffCatalog.css", "utf8")

describe("staff catalog heading on a narrow screen", () => {
  it("does not keep the title's 12rem row basis once the heading stacks", () => {
    const start = css.indexOf("@media (max-width: 760px)")
    const mobile = css.slice(start, css.indexOf("@media", start + 1))
    expect(mobile).toMatch(/\.staff-catalog-heading > div:first-child\s*\{[^}]*flex:\s*0 1 auto/)
  })
})
