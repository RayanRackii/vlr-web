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

describe("cadastro focus layout", () => {
  const cadastroCss = readFileSync("src/features/assistant/cadastro.css", "utf8")

  it("keeps the 1120px cap on .cadastro-page itself", () => {
    expect(cadastroCss).toMatch(/\.cadastro-page\s*\{[^}]*max-width:\s*min\(1120px, 100%\)[^}]*margin:\s*0 auto/)
  })

  it("never un-caps .cadastro-page when it is the direct child of main", () => {
    expect(cadastroCss).not.toMatch(/:has\(\.cadastro-page\)\s*>\s*div\s*\{/)
    expect(cadastroCss).toMatch(/:has\(\.cadastro-page\)\s*>\s*div:not\(\.cadastro-page\)\s*\{\s*max-width:\s*none/)
  })
})
