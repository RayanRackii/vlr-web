import postcss from "postcss"
import tailwindcss from "tailwindcss"
import { render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import tailwindConfig from "../../../tailwind.config"
import { FilterTabs } from "@/components/data-table/FilterTabs"
import { tabBaseClass, tabLineStateClass, tabListClass } from "@/components/ui/tabs-style"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

function markup() {
  return renderToStaticMarkup(
    <Tabs defaultValue="a">
      <TabsList variant="line">
        <TabsTrigger value="a">A</TabsTrigger>
        <TabsTrigger value="b">B</TabsTrigger>
      </TabsList>
      <TabsContent value="a">Panel</TabsContent>
    </Tabs>,
  )
}

async function compile(html: string) {
  const result = await postcss([
    tailwindcss({ ...tailwindConfig, content: [{ raw: html, extension: "html" }] }),
  ]).process("@tailwind utilities;", { from: undefined })
  return result.css.replace(/\s+/g, " ")
}

describe("Tabs styling hooks", () => {
  it("exposes orientation and active state as data attributes", () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList variant="line">
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel</TabsContent>
      </Tabs>,
    )
    expect(container.querySelector('[data-slot="tabs"]')).toHaveAttribute("data-orientation", "horizontal")
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("data-active")
    expect(screen.getByRole("tab", { name: "B" })).not.toHaveAttribute("data-active")
    const active = screen.getByRole("tab", { name: "A" })
    // The line is a real border-b-2 on the trigger (no pseudo-element that a clipped list can hide).
    expect(active.className).toContain("border-b-2")
    expect(active.className).toContain("data-active:border-primary")
    expect(active.className).not.toContain("before:")
  })

  it("compiles the orientation and active variants to real selectors", async () => {
    const css = await compile(markup())
    // horizontal tabs stack the list above the panel (not a side column)
    expect(css).toMatch(/\[data-orientation="horizontal"\] ?\{ ?flex-direction: column/)
    // The active line is a bottom border selected by Base UI's data-active attribute.
    expect(css).toMatch(/\.data-active\\:border-primary\[data-active\] ?\{[^}]*border-color/)
    expect(css).toMatch(/\.data-active\\:text-primary\[data-active\] ?\{/)
  })
})

function lineTabs() {
  render(
    <Tabs value="a">
      <TabsList variant="line" aria-label="Views">
        <TabsTrigger value="a">Alpha</TabsTrigger>
        <TabsTrigger value="b">Beta</TabsTrigger>
      </TabsList>
    </Tabs>,
  )
}

describe("line Tabs", () => {
  it("styles the selected trigger with the primary bottom border and the others transparent", () => {
    lineTabs()
    const active = screen.getByRole("tab", { name: "Alpha" })
    const inactive = screen.getByRole("tab", { name: "Beta" })
    expect(active).toHaveAttribute("data-active")
    expect(inactive).not.toHaveAttribute("data-active")
    for (const tab of [active, inactive]) expect(tab).toHaveClass("border-b-2", "min-h-11", "px-1", "text-sm")
    expect(active).toHaveClass("data-active:border-primary", "data-active:text-primary")
    expect(inactive).toHaveClass("border-transparent", "text-muted-foreground")
    expect(active).not.toHaveClass("before:bg-foreground")
  })

  it("shares its list and trigger classes with FilterTabs", () => {
    lineTabs()
    expect(screen.getByRole("tablist")).toHaveClass(...tabListClass.split(" ").filter((c) => !c.includes("[")))
    render(<FilterTabs label="Tipo" allLabel="Todos" value={null} onChange={() => {}} options={[{ value: "x", label: "X" }]} />)
    const all = screen.getByRole("button", { name: "Todos" })
    const other = screen.getByRole("button", { name: "X" })
    const baseTokens = tabBaseClass.split(" ")
    expect(all).toHaveClass(...baseTokens)
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveClass(...baseTokens)
    expect(all).toHaveClass("border-primary", "font-medium", "text-primary")
    expect(other).toHaveClass("border-transparent", "text-muted-foreground")
    expect(tabLineStateClass).toContain("data-active:border-primary")
  })
})
