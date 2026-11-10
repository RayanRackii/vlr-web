import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync("src/features/catalog/components/agenda/agenda.css", "utf8")

describe("resource agenda narrow layout", () => {
  it("drops the wide grid and the fixed booking panel below 768px", () => {
    const start = css.indexOf(".resource-agenda-scroll {\n    display: none;")
    const mobile = start < 0 ? css : css.slice(Math.max(0, start - 80))
    expect(mobile).toMatch(/@media \(max-width: 767px\)[\s\S]*\.resource-agenda-scroll\s*\{[^}]*display:\s*none/)
    expect(mobile).toMatch(/\.resource-agenda-stack\s*\{[^}]*display:\s*grid/)
    expect(mobile).toMatch(/\.resource-agenda-panel\s*\{[^}]*position:\s*static/)
    expect(css).not.toMatch(/\.resource-agenda-panel\s*\{[^}]*position:\s*fixed/)
  })
})
