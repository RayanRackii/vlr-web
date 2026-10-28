import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const css = readFileSync("src/features/users/people-access.css", "utf8")

// Roles and custom registration fields have no other delete path (the edit
// dialog has none), so the delete trigger must never be hidden at any width.
describe("people-access.css", () => {
  it("never hides the delete action", () => {
    const rules = css.match(/\.people-delete-action\s*\{[^}]*\}/g) ?? []
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      expect(rule).not.toMatch(/display:\s*none/)
      expect(rule).not.toMatch(/visibility:\s*hidden/)
    }
  })

  it("keeps the delete action above the full-row edit overlay with a 44px target", () => {
    const mobile = css.slice(css.indexOf("@media (max-width: 1023px)"))
    const rule = mobile.match(/\.people-delete-action\s*\{[^}]*\}/)?.[0] ?? ""
    expect(rule).toMatch(/z-index:\s*2/)
    expect(rule).toMatch(/min-height:\s*44px/)
  })
})
