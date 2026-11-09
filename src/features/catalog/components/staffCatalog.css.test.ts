import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync("src/features/catalog/components/staffCatalog.css", "utf8")

describe("staff catalog products table", () => {
  it("compacts row actions to fixed icon buttons and a labeled assistant", () => {
    expect(css).toMatch(/\.staff-catalog-action\s*\{[^}]*width:\s*44px/)
    expect(css).toMatch(/\.staff-catalog-assistant\b/)
  })

  it("hides category and tag columns below 1440px so the row fits beside the sidebar", () => {
    const narrow = css.slice(css.indexOf("@media (max-width: 1439px)"))
    expect(narrow).toMatch(
      /\.staff-catalog-products-table :is\(\[data-column="categories"\], \[data-column="tags"\]\)\s*\{[^}]*display:\s*none/,
    )
  })

  it("keeps the phone card layout and the in-card assistant link", () => {
    const mobile = css.slice(css.indexOf("@media (max-width: 760px)"))
    expect(mobile).toMatch(/\[data-column="actions"\]\)\s*\{\s*display:\s*none/)
    const desktop = css.slice(css.indexOf("@media (min-width: 761px)"))
    expect(desktop).toMatch(/\.staff-catalog-assistant-inline\s*\{[^}]*display:\s*none/)
  })
})
