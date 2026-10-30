import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const css = readFileSync("src/features/users/people-access.css", "utf8")

// Roles and custom registration fields have no delete path in the edit dialog,
// so deletion must stay reachable at every width. Below 1024px the per-row
// delete button is replaced by the bottom action sheet, which carries the
// delete action instead; at desktop widths the per-row button stays visible.
describe("people-access.css", () => {
  it("wraps mobile pills while leaving desktop underline tabs unchanged", () => {
    const breakpoint = css.indexOf("@media (max-width: 700px)")
    const mobile = css.slice(breakpoint)
    expect(mobile).toMatch(/\.people-tabs\s*\{[^}]*flex-wrap:\s*wrap/)
    expect(mobile).toMatch(/\.people-tabs\s*\{[^}]*gap:\s*6px/)
    expect(mobile).toMatch(/\.people-tabs\s*\{[^}]*overflow-x:\s*visible/)
    expect(css.slice(0, breakpoint)).not.toMatch(/\.people-tabs\s*\{[^}]*flex-wrap:\s*wrap/)
  })

  it("replaces the per-row delete with the action sheet below 1024px", () => {
    const mobile = css.slice(css.indexOf("@media (max-width: 1023px)"))
    expect(mobile).toMatch(/\.people-delete-action\s*\{[^}]*display:\s*none/)
    // The sheet still provides a reachable delete path.
    expect(css).toMatch(/\.people-sheet-destructive\b/)
    expect(css).toMatch(/\.people-sheet-delete\b/)
  })

  it("keeps the per-row delete visible at desktop widths", () => {
    const base = css.slice(0, css.indexOf("@media (max-width: 1023px)"))
    expect(base).not.toMatch(/\.people-delete-action\s*\{[^}]*display:\s*none/)
    expect(base).not.toMatch(/\.people-delete-action\s*\{[^}]*visibility:\s*hidden/)
  })
})
